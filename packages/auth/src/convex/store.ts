import { requireEnv } from "@repo/helpers";
import { internalMutationGeneric, internalQueryGeneric } from "convex/server";
import { v } from "convex/values";
import { SignJWT, importJWK, type JWK } from "jose";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const SWEEP_BATCH_SIZE = 64;
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH_BITS = 256;

type AnyCtx = { db: any };
type BufferSource = NodeJS.BufferSource;

type AuthJwks = {
  kid: string;
  privateJwk: JWK;
  publicJwks: { keys: JWK[] };
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    PASSWORD_KEY_LENGTH_BITS,
  );

  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const derived = await derivePassword(password, salt, PASSWORD_ITERATIONS);

  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const salt = fromBase64Url(parts[2]);
  const expected = fromBase64Url(parts[3]);
  const derived = await derivePassword(password, salt, iterations);

  if (derived.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < derived.length; i++) {
    diff |= derived[i] ^ expected[i];
  }

  return diff === 0;
}

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

const internalStore = {
  mutation: internalMutation,
  query: internalQuery,
};

export { getPublicJwks, internalStore };
