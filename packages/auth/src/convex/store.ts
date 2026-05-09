import { requireEnv } from "@repo/helpers";
import {
  GenericDataModel,
  GenericMutationCtx,
  internalMutationGeneric,
  internalQueryGeneric,
} from "convex/server";
import { GenericId, v } from "convex/values";
import { SignJWT, importJWK, type JWK } from "jose";

import { Auth, User } from "../svelte/index.types";
import { Account, Verification } from "./index.types";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const SWEEP_BATCH_SIZE = 64;

type PublicJwks = {
  kid: string;
  privateJwk: JWK;
  publicJwks: { keys: JWK[] };
};

function getPublicJwks() {
  return JSON.stringify((JSON.parse(requireEnv("PUBLIC_JWKS")) as PublicJwks).publicJwks);
}

function randomToken(byteLength = 32) {
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function signJWT(userId: GenericId<"users">) {
  const publicJwks = JSON.parse(requireEnv("PUBLIC_JWKS")) as PublicJwks;
  const privateKey = await importJWK(publicJwks.privateJwk, "RS256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: publicJwks.kid })
    .setSubject(userId)
    .setAudience("convex")
    .setIssuer(requireEnv("CONVEX_SITE_URL"))
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(privateKey);
}

async function findAndSweepVerification(
  ctx: GenericMutationCtx<GenericDataModel>,
  identifier: string,
) {
  const entry = (await ctx.db
    .query("verifications")
    .withIndex("by_identifier", (q) => q.eq("identifier", identifier))
    .first()) as Verification | null;

  const expired = (await ctx.db
    .query("verifications")
    .withIndex("by_expires_at", (q) => q.lte("expiresAt", Date.now()))
    .take(SWEEP_BATCH_SIZE)) as Verification[];

  for (const row of expired) {
    await ctx.db.delete(row._id);
  }

  if (entry && expired.some((row) => row._id === entry._id)) {
    return null;
  }

  return entry;
}

async function createSession(
  ctx: GenericMutationCtx<GenericDataModel>,
  userId: GenericId<"users">,
) {
  const token = randomToken();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  await ctx.db.insert("sessions", {
    userId,
    token,
    expiresAt,
  });

  return {
    accessToken: await signJWT(userId),
    expiresAt,
    sessionToken: token,
  };
}

const internalQuery = internalQueryGeneric({
  args: {
    payload: v.object({ token: v.string(), type: v.literal("session:get") }),
  },
  handler: async (ctx, { payload }) => {
    const session = (await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", payload.token))
      .first()) as {
      userId: GenericId<"users">;
      token: string;
      expiresAt: number;
    } | null;

    if (!session || session.expiresAt <= Date.now()) {
      return null;
    }

    const user = (await ctx.db.get(session.userId)) as User | null;
    if (!user) return null;

    return {
      user,
      token: await signJWT(user._id),
      expiresAt: session.expiresAt,
    } satisfies Auth;
  },
});

const internalMutation = internalMutationGeneric({
  args: {
    payload: v.union(
      v.object({
        type: v.literal("session:revoke"),
        token: v.string(),
      }),
      v.object({
        type: v.literal("oauth:authorize"),
        provider: v.union(v.literal("apple"), v.literal("google")),
        state: v.string(),
        nonce: v.string(),
        verifier: v.optional(v.string()),
        expiresAt: v.number(),
      }),
      v.object({
        type: v.literal("oauth:verify"),
        provider: v.union(v.literal("apple"), v.literal("google")),
        state: v.string(),
      }),
      v.object({
        type: v.literal("oauth:finalize"),
        provider: v.union(v.literal("apple"), v.literal("google")),
        accountId: v.string(),
        email: v.string(),
        emailVerified: v.boolean(),
        firstName: v.string(),
        lastName: v.string(),
      }),
      v.object({
        type: v.literal("oauth:claim"),
        code: v.string(),
      }),
    ),
  },
  handler: async (ctx, { payload }) => {
    switch (payload.type) {
      case "session:revoke": {
        const session = (await ctx.db
          .query("sessions")
          .withIndex("by_token", (q) => q.eq("token", payload.token))
          .first()) as {
          _id: GenericId<"sessions">;
          token: string;
          expiresAt: number;
        } | null;

        if (session) {
          await ctx.db.delete(session._id);
        }

        return null;
      }

      case "oauth:authorize": {
        await ctx.db.insert("verifications", {
          identifier: payload.state,
          value: JSON.stringify({
            provider: payload.provider,
            nonce: payload.nonce,
            verifier: payload.verifier,
          }),
          expiresAt: payload.expiresAt,
        });

        return { ok: true };
      }

      case "oauth:verify": {
        const entry = await findAndSweepVerification(ctx, payload.state);
        if (!entry) return null;

        await ctx.db.delete(entry._id);

        if (entry.expiresAt <= Date.now()) {
          return null;
        }

        let parsed: { provider: string; nonce: string; verifier?: string };

        try {
          parsed = JSON.parse(entry.value);
        } catch {
          return null;
        }

        if (parsed.provider !== payload.provider) {
          return null;
        }

        return {
          nonce: parsed.nonce,
          verifier: parsed.verifier,
        };
      }

      case "oauth:finalize": {
        const existingAccount = (await ctx.db
          .query("accounts")
          .withIndex("by_provider_account", (q) => q.eq("provider", payload.provider))
          .filter((q) => q.eq(q.field("accountId"), payload.accountId))
          .first()) as Account | null;

        let userId = existingAccount?.userId;

        if (!userId) {
          const existingUser = (await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", payload.email))
            .first()) as User | null;

          userId = existingUser
            ? existingUser._id
            : await ctx.db.insert("users", {
                email: payload.email,
                emailVerified: payload.emailVerified,
                firstName: payload.firstName,
                lastName: payload.lastName,
                plan: "free",
              });

          await ctx.db.insert("accounts", {
            userId,
            provider: payload.provider,
            accountId: payload.accountId,
          });
        }

        const session = await createSession(ctx, userId);
        const code = randomToken();

        await ctx.db.insert("verifications", {
          identifier: code,
          value: JSON.stringify({
            sessionToken: session.sessionToken,
            accessToken: session.accessToken,
            expiresAt: session.expiresAt,
          }),
          expiresAt: Date.now() + 60_000,
        });

        return { code };
      }

      case "oauth:claim": {
        const entry = await findAndSweepVerification(ctx, payload.code);
        if (!entry) return null;

        await ctx.db.delete(entry._id);

        if (entry.expiresAt <= Date.now()) {
          return null;
        }

        try {
          return JSON.parse(entry.value) as {
            sessionToken: string;
            accessToken: string;
            expiresAt: number;
          };
        } catch {
          return null;
        }
      }

      default: {
        const _never: never = payload;
        throw new Error(`Unsupported auth mutation op: ${JSON.stringify(_never)}`);
      }
    }
  },
});

const authStore = {
  mutation: internalMutation,
  query: internalQuery,
};

export { getPublicJwks, authStore };
