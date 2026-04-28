import { requireEnv } from "@repo/helpers";
import { internalMutationGeneric, internalQueryGeneric } from "convex/server";
import { v } from "convex/values";
import { SignJWT, importJWK, type JWK } from "jose";

import { internalAction } from "./crypto";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const SWEEP_BATCH_SIZE = 64;

type AnyCtx = { db: any };

type AuthJwks = {
  kid: string;
  privateJwk: JWK;
  publicJwks: { keys: JWK[] };
};

async function hashSessionToken(token: string): Promise<string> {
  const secret = requireEnv("AUTH_SECRET");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${token}:${secret}`),
  );

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(byteLength = 32): string {
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

function loadAuthJwks(): AuthJwks {
  return JSON.parse(requireEnv("AUTH_JWKS")) as AuthJwks;
}

function getPublicJwks(): string {
  return JSON.stringify(loadAuthJwks().publicJwks);
}

async function signAuthToken(userId: string): Promise<string> {
  const jwks = loadAuthJwks();
  const privateKey = await importJWK(jwks.privateJwk, "RS256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: jwks.kid })
    .setSubject(userId)
    .setAudience("convex")
    .setIssuer(requireEnv("CONVEX_SITE_URL"))
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(privateKey);
}

async function findAndSweepVerification(db: any, identifier: string) {
  const entry = await db
    .query("verifications")
    .withIndex("by_identifier", (q: any) => q.eq("identifier", identifier))
    .first();

  const expired = await db
    .query("verifications")
    .withIndex("by_expires_at", (q: any) => q.lte("expiresAt", Date.now()))
    .take(SWEEP_BATCH_SIZE);

  for (const row of expired) {
    await db.delete(row._id);
  }

  if (entry && expired.some((row: any) => row._id === entry._id)) return null;

  return entry;
}

async function createSession(ctx: AnyCtx, userId: unknown) {
  const token = randomToken();
  const refreshTokenHash = await hashSessionToken(token);
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  await ctx.db.insert("sessions", {
    userId,
    refreshTokenHash,
    expiresAt,
  });

  return {
    accessToken: await signAuthToken(String(userId)),
    expiresAt,
    sessionToken: token,
  };
}

const internalQuery = internalQueryGeneric({
  args: {
    payload: v.object({
      type: v.literal("session:get"),
      token: v.string(),
    }),
  },
  handler: async (ctx, { payload }) => {
    const refreshTokenHash = await hashSessionToken(payload.token);

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_refresh_token_hash", (q) => q.eq("refreshTokenHash", refreshTokenHash))
      .first();

    if (!session) return null;
    if (session.expiresAt <= Date.now()) return null;

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        plan: user.plan,
        verified: user.verified,
      },
      token: await signAuthToken(String(user._id)),
      expires: session.expiresAt,
    };
  },
});

const internalMutation = internalMutationGeneric({
  args: {
    payload: v.union(
      v.object({
        type: v.literal("credentials:register"),
        email: v.string(),
        passwordHash: v.string(),
        firstName: v.string(),
        lastName: v.string(),
      }),
      v.object({
        type: v.literal("credentials:login"),
        email: v.string(),
      }),
      v.object({
        type: v.literal("credentials:login"),
        email: v.string(),
        passwordHash: v.string(),
      }),
      v.object({
        type: v.literal("session:revoke"),
        token: v.string(),
      }),
      v.object({
        type: v.literal("oauth:authorize:start"),
        provider: v.union(v.literal("apple"), v.literal("google")),
        state: v.string(),
        nonce: v.string(),
        verifier: v.optional(v.string()),
        expiresAt: v.number(),
      }),
      v.object({
        type: v.literal("oauth:authorize:consume-state"),
        provider: v.union(v.literal("apple"), v.literal("google")),
        state: v.string(),
      }),
      v.object({
        type: v.literal("oauth:authenticate:finalize"),
        provider: v.union(v.literal("apple"), v.literal("google")),
        subject: v.string(),
        email: v.string(),
        firstName: v.string(),
        lastName: v.string(),
        verified: v.boolean(),
      }),
      v.object({
        type: v.literal("oauth:handoff:issue"),
        sessionToken: v.string(),
        accessToken: v.string(),
        expiresAt: v.number(),
      }),
      v.object({
        type: v.literal("oauth:handoff:claim"),
        code: v.string(),
      }),
    ),
  },
  handler: async (ctx, { payload }) => {
    const db = ctx.db as any;

    switch (payload.type) {
      case "credentials:register": {
        const existing = await db
          .query("users")
          .withIndex("by_email", (q: any) => q.eq("email", payload.email))
          .first();

        if (existing) throw new Error("Account already exists.");

        const userId = await db.insert("users", {
          email: payload.email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          plan: "free",
          verified: false,
        });

        await db.insert("accounts", {
          userId,
          provider: "credentials",
          passwordHash: payload.passwordHash,
        });

        return createSession({ db }, userId);
      }

      case "credentials:login": {
        const existing = await db
          .query("users")
          .withIndex("by_email", (q: any) => q.eq("email", payload.email))
          .first();

        if (!existing) return null;

        const account = await db
          .query("accounts")
          .withIndex("by_user", (q: any) => q.eq("userId", existing._id))
          .filter((q: any) => q.eq(q.field("provider"), "credentials"))
          .first();

        if (!account?.passwordHash) return null;

        if (!("passwordHash" in payload)) {
          return {
            userId: existing._id,
            passwordHash: account.passwordHash,
          };
        }

        if (account.passwordHash !== payload.passwordHash) throw new Error("Invalid credentials.");

        return createSession({ db }, existing._id);
      }

      case "session:revoke": {
        const refreshTokenHash = await hashSessionToken(payload.token);

        const session = await db
          .query("sessions")
          .withIndex("by_refresh_token_hash", (q: any) =>
            q.eq("refreshTokenHash", refreshTokenHash),
          )
          .first();

        if (session) await db.delete(session._id);

        return { ok: true };
      }

      case "oauth:authorize:start": {
        await db.insert("verifications", {
          type: "oauth:state",
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

      case "oauth:authorize:consume-state": {
        const entry = await findAndSweepVerification(db, payload.state);

        if (!entry || entry.type !== "oauth:state") return null;

        await db.delete(entry._id);
        if (entry.expiresAt <= Date.now()) return null;

        let parsed: { provider: string; nonce: string; verifier?: string };
        try {
          parsed = JSON.parse(entry.value);
        } catch {
          return null;
        }

        if (parsed.provider !== payload.provider) return null;

        return { nonce: parsed.nonce, verifier: parsed.verifier };
      }

      case "oauth:authenticate:finalize": {
        const existingAccount = await db
          .query("accounts")
          .withIndex("by_provider_subject", (q: any) =>
            q.eq("provider", payload.provider).eq("subject", payload.subject),
          )
          .first();

        let userId = existingAccount?.userId;

        if (!userId) {
          const existingUser = await db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", payload.email))
            .first();

          userId = existingUser
            ? existingUser._id
            : await db.insert("users", {
                email: payload.email,
                firstName: payload.firstName,
                lastName: payload.lastName,
                plan: "free",
                verified: payload.verified,
              });

          await db.insert("accounts", {
            userId,
            provider: payload.provider,
            subject: payload.subject,
          });
        }

        return createSession({ db }, userId);
      }

      case "oauth:handoff:issue": {
        const code = randomToken();

        await db.insert("verifications", {
          type: "oauth:handoff",
          identifier: code,
          value: JSON.stringify({
            sessionToken: payload.sessionToken,
            accessToken: payload.accessToken,
            expiresAt: payload.expiresAt,
          }),
          expiresAt: Date.now() + 60_000,
        });

        return { code };
      }

      case "oauth:handoff:claim": {
        const entry = await findAndSweepVerification(db, payload.code);

        if (!entry || entry.type !== "oauth:handoff") return null;

        await db.delete(entry._id);
        if (entry.expiresAt <= Date.now()) return null;

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
  action: internalAction,
  query: internalQuery,
};

export { getPublicJwks, authStore };
