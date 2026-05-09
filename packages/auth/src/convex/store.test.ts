import { convexTest } from "convex-test";
import { defineSchema, defineTable, GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { v } from "convex/values";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

type QueryHandler = (
  ctx: GenericQueryCtx<any>,
  args: {
    payload: {
      type: "session:get";
      token: string;
    };
  },
) => Promise<unknown>;

type MutationHandler = (
  ctx: GenericMutationCtx<any>,
  args: {
    payload: { type: string } & Record<string, unknown>;
  },
) => Promise<unknown>;

const modules = import.meta.glob("../../../convex/src/**/*.ts");

const schema = defineSchema({
  users: defineTable({
    email: v.string(),
    emailVerified: v.boolean(),
    firstName: v.string(),
    lastName: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro")),
  }).index("by_email", ["email"]),

  accounts: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("apple"), v.literal("google")),
    accountId: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_provider_account", ["provider", "accountId"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  verifications: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
  })
    .index("by_identifier", ["identifier"])
    .index("by_expires_at", ["expiresAt"]),
});

const { internalMutationGenericMock, internalQueryGenericMock, requireEnvMock } = vi.hoisted(
  () => ({
    internalMutationGenericMock: vi.fn((definition: { handler: MutationHandler }) => definition),
    internalQueryGenericMock: vi.fn((definition: { handler: QueryHandler }) => definition),
    requireEnvMock: vi.fn((key: string) => {
      const env: Record<string, string> = {
        PUBLIC_JWKS: JSON.stringify({
          kid: "kid-1",
          privateJwk: { kty: "RSA", n: "n", e: "AQAB", d: "d" },
          publicJwks: { keys: [{ kty: "RSA", n: "n", e: "AQAB", kid: "kid-1" }] },
        }),
        AUTH_SECRET: "auth-secret",
        CONVEX_SITE_URL: "https://app.example",
      };
      const value = env[key];
      if (!value) throw new Error(`Missing env: ${key}`);
      return value;
    }),
  }),
);

vi.mock("convex/server", async () => {
  const actual = await vi.importActual<typeof import("convex/server")>("convex/server");
  return {
    ...actual,
    internalMutationGeneric: internalMutationGenericMock,
    internalQueryGeneric: internalQueryGenericMock,
  };
});

vi.mock("@repo/helpers", () => ({ requireEnv: requireEnvMock }));

vi.mock("jose", () => {
  class SignJWTMock {
    private subject = "";

    setProtectedHeader(): this {
      return this;
    }

    setSubject(subject: string): this {
      this.subject = subject;
      return this;
    }

    setAudience(): this {
      return this;
    }

    setIssuer(): this {
      return this;
    }

    setIssuedAt(): this {
      return this;
    }

    setExpirationTime(): this {
      return this;
    }

    async sign(): Promise<string> {
      return `signed:${this.subject}`;
    }
  }

  return {
    importJWK: vi.fn(async () => ({ alg: "RS256" })),
    SignJWT: SignJWTMock,
  };
});

vi.mock("./crypto", () => ({
  internalAction: { handler: vi.fn() },
}));

let mutationHandler: MutationHandler;
let queryHandler: QueryHandler;

beforeAll(async () => {
  await import("./store");
  queryHandler = internalQueryGenericMock.mock.calls[0][0].handler;
  mutationHandler = internalMutationGenericMock.mock.calls[0][0].handler;
});

describe("convex store security/regression", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should consume oauth state once and block provider mismatch", async () => {
    const t = convexTest({ schema, modules });

    await t.run(async (ctx) => {
      await ctx.db.insert("verifications", {
        identifier: "state-1",
        value: JSON.stringify({
          provider: "google",
          nonce: "nonce-1",
          verifier: "pkce-1",
        }),
        expiresAt: Date.now() + 1000,
      });
    });

    const mismatch = await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: { type: "oauth:verify", provider: "apple", state: "state-1" },
      }),
    );

    const replay = await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: { type: "oauth:verify", provider: "google", state: "state-1" },
      }),
    );

    expect(mismatch).toBeNull();
    expect(replay).toBeNull();
  });

  it("should reject malformed and expired oauth state", async () => {
    const t = convexTest({ schema, modules });

    await t.run(async (ctx) => {
      await ctx.db.insert("verifications", {
        identifier: "state-bad",
        value: "{not-json",
        expiresAt: Date.now() + 1000,
      });

      await ctx.db.insert("verifications", {
        identifier: "state-expired",
        value: JSON.stringify({
          provider: "google",
          nonce: "n",
          verifier: "v",
        }),
        expiresAt: Date.now() - 1,
      });
    });

    const malformed = await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: {
          type: "oauth:verify",
          provider: "google",
          state: "state-bad",
        },
      }),
    );

    const expired = await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: {
          type: "oauth:verify",
          provider: "google",
          state: "state-expired",
        },
      }),
    );

    expect(malformed).toBeNull();
    expect(expired).toBeNull();
  });

  it("should prevent oauth account takeover via existing provider+accountId", async () => {
    const t = convexTest({ schema, modules });

    const userId = await t.run(async (ctx) => {
      const created = await ctx.db.insert("users", {
        email: "existing@example.com",
        emailVerified: true,
        firstName: "Ex",
        lastName: "Isting",
        plan: "free",
      });

      await ctx.db.insert("accounts", {
        userId: created,
        provider: "google",
        accountId: "subject-1",
      });

      return created;
    });

    await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: {
          type: "oauth:finalize",
          provider: "google",
          accountId: "subject-1",
          email: "attacker@example.com",
          emailVerified: false,
          firstName: "Attacker",
          lastName: "Name",
        },
      }),
    );

    const linkedAccounts = await t.run(async (ctx) =>
      ctx.db
        .query("accounts")
        .withIndex("by_provider_account", (q) =>
          q.eq("provider", "google").eq("accountId", "subject-1"),
        )
        .collect(),
    );

    expect(linkedAccounts).toHaveLength(1);
    expect(linkedAccounts[0]?.userId).toBe(userId);
  });

  it("should enforce one-time oauth handoff claim and expiry", async () => {
    const t = convexTest({ schema, modules });

    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1000);

    const issued = (await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: {
          type: "oauth:finalize",
          provider: "google",
          accountId: "subject-1",
          email: "user@example.com",
          emailVerified: true,
          firstName: "User",
          lastName: "Test",
        },
      }),
    )) as { code: string };

    const first = await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: { type: "oauth:claim", code: issued.code },
      }),
    );

    const replay = await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: { type: "oauth:claim", code: issued.code },
      }),
    );

    now.mockReturnValue(1000);

    const expiring = (await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: {
          type: "oauth:finalize",
          provider: "google",
          accountId: "subject-exp",
          email: "exp@example.com",
          emailVerified: true,
          firstName: "Exp",
          lastName: "Iring",
        },
      }),
    )) as { code: string };

    now.mockReturnValue(70000);

    const expired = await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: { type: "oauth:claim", code: expiring.code },
      }),
    );

    expect(first).toEqual({
      sessionToken: expect.any(String),
      accessToken: expect.any(String),
      expiresAt: expect.any(Number),
    });
    expect(replay).toBeNull();
    expect(expired).toBeNull();
  });

  it("should reject malformed oauth handoff payload", async () => {
    const t = convexTest({ schema, modules });

    await t.run(async (ctx) => {
      await ctx.db.insert("verifications", {
        identifier: "handoff-bad-json",
        value: "{not-json",
        expiresAt: Date.now() + 1000,
      });
    });

    const claimed = await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: { type: "oauth:claim", code: "handoff-bad-json" },
      }),
    );

    expect(claimed).toBeNull();
  });

  it("should revoke only matching session", async () => {
    const t = convexTest({ schema, modules });

    const validToken = "v".repeat(64);
    const otherToken = "o".repeat(64);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "session@example.com",
        emailVerified: false,
        firstName: "Sess",
        lastName: "Ion",
        plan: "free",
      });

      await ctx.db.insert("sessions", {
        userId,
        token: validToken,
        expiresAt: Date.now() + 10000,
      });

      await ctx.db.insert("sessions", {
        userId,
        token: otherToken,
        expiresAt: Date.now() + 10000,
      });
    });

    await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: { type: "session:revoke", token: "x".repeat(64) },
      }),
    );

    await t.mutation(async (ctx) =>
      mutationHandler(ctx, {
        payload: { type: "session:revoke", token: validToken },
      }),
    );

    const sessions = await t.run(async (ctx) => ctx.db.query("sessions").collect());

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.token).toBe(otherToken);
  });

  it("should return null for expired, unknown, or missing-user sessions", async () => {
    const t = convexTest({ schema, modules });

    const token = "t".repeat(64);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "john@example.com",
        emailVerified: false,
        firstName: "John",
        lastName: "Doe",
        plan: "free",
      });

      await ctx.db.insert("sessions", {
        userId,
        token,
        expiresAt: Date.now() - 1,
      });
    });

    const expired = await t.query(async (ctx) =>
      queryHandler(ctx, { payload: { type: "session:get", token } }),
    );

    const unknown = await t.query(async (ctx) =>
      queryHandler(ctx, {
        payload: { type: "session:get", token: "u".repeat(64) },
      }),
    );

    const token2 = "z".repeat(64);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "ghost@example.com",
        emailVerified: false,
        firstName: "Ghost",
        lastName: "User",
        plan: "free",
      });

      await ctx.db.insert("sessions", {
        userId,
        token: token2,
        expiresAt: Date.now() + 10000,
      });

      await ctx.db.delete(userId);
    });

    const missingUser = await t.query(async (ctx) =>
      queryHandler(ctx, {
        payload: {
          type: "session:get",
          token: token2,
        },
      }),
    );

    expect(expired).toBeNull();
    expect(unknown).toBeNull();
    expect(missingUser).toBeNull();
  });
});
