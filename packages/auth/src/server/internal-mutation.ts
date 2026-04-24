import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";

import { hash, hashPassword, randomToken, signAuthToken, verifyPassword } from "../utils";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

// The Convex generic data model doesn't know about our schema, so we lean on
// `any` for the db/query builders here and rely on the `args` validator to keep
// runtime values honest.
type AnyCtx = { db: any };

// Mirrors better-auth's `findVerificationValue`: looks up by identifier and
// opportunistically sweeps expired rows in the same transaction. Bounded by
// `.take()` to stay within Convex transaction limits — under steady traffic
// this keeps the table self-healing without any cron.
const SWEEP_BATCH_SIZE = 64;

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

  // The lookup row may have been swept already; in that case treat it as gone.
  if (entry && expired.some((row: any) => row._id === entry._id)) return null;

  return entry;
}

async function createSession(ctx: AnyCtx, userId: unknown) {
  const token = randomToken();
  const refreshTokenHash = await hash("session", token);
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

const internalMutation = internalMutationGeneric({
  args: {
    payload: v.union(
      v.object({
        type: v.literal("credentials"),
        email: v.string(),
        password: v.string(),
        flow: v.union(v.literal("register"), v.literal("login")),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
      }),
      v.object({
        type: v.literal("session:delete"),
        token: v.string(),
      }),
      v.object({
        type: v.literal("oauth:start"),
        provider: v.union(v.literal("apple"), v.literal("google")),
        state: v.string(),
        nonce: v.string(),
        verifier: v.optional(v.string()),
        expiresAt: v.number(),
      }),
      v.object({
        type: v.literal("oauth:consume"),
        provider: v.union(v.literal("apple"), v.literal("google")),
        state: v.string(),
      }),
      v.object({
        type: v.literal("oauth:complete"),
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
      case "credentials": {
        const existing = await db
          .query("users")
          .withIndex("by_email", (q: any) => q.eq("email", payload.email))
          .first();

        if (payload.flow === "register") {
          if (existing) throw new Error("Account already exists.");
          if (!payload.firstName || !payload.lastName) {
            throw new Error("First and last name required to register.");
          }

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
            passwordHash: await hashPassword(payload.password),
          });

          return createSession({ db }, userId);
        }

        if (!existing) throw new Error("Invalid credentials.");

        const account = await db
          .query("accounts")
          .withIndex("by_user", (q: any) => q.eq("userId", existing._id))
          .filter((q: any) => q.eq(q.field("provider"), "credentials"))
          .first();

        if (!account?.passwordHash) throw new Error("Invalid credentials.");

        const ok = await verifyPassword(payload.password, account.passwordHash);
        if (!ok) throw new Error("Invalid credentials.");

        return createSession({ db }, existing._id);
      }

      case "session:delete": {
        const refreshTokenHash = await hash("session", payload.token);

        const session = await db
          .query("sessions")
          .withIndex("by_refresh_token_hash", (q: any) =>
            q.eq("refreshTokenHash", refreshTokenHash),
          )
          .first();

        if (session) await db.delete(session._id);

        return { ok: true };
      }

      case "oauth:start": {
        await db.insert("verifications", {
          type: "oauth_state",
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

      case "oauth:consume": {
        const entry = await findAndSweepVerification(db, payload.state);

        if (!entry || entry.type !== "oauth_state") return null;

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

      case "oauth:complete": {
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
          type: "oauth_handoff",
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

        if (!entry || entry.type !== "oauth_handoff") return null;

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

export { internalMutation };
