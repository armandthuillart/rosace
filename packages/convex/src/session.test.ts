import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { convexTest } from "convex-test";
import { exportJWK, generateKeyPair } from "jose";

import schema from "./schema";
import { internal } from "./_generated/api";

// @ts-expect-error - modules are loaded dynamically
const modules = import.meta.glob("./**/*.ts");

let kid: string;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  kid = crypto.randomUUID();
  const privateJwk = { ...(await exportJWK(privateKey)), alg: "RS256" };
  const publicJwk = { ...(await exportJWK(publicKey)), alg: "RS256" };

  vi.stubEnv(
    "JWKS",
    JSON.stringify({
      kid,
      private: privateJwk,
      public: { keys: [publicJwk] },
    }),
  );
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.cloud");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

function future(secondsFromNow: number) {
  return Date.now() + secondsFromNow * 1000;
}

function past(secondsAgo: number) {
  return Date.now() - secondsAgo * 1000;
}

describe("getSession", () => {
  it("should return session with user for valid token", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        plan: "pro",
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", {
        token: "valid-token",
        userId,
        expiresAt: future(3600),
      });
    });

    const result = await t.query(internal.session.getSession, { token: "valid-token" });

    expect(result).not.toBeNull();
    expect(result!.user.email).toBe("alice@example.com");
    expect(result!.user.firstName).toBe("Alice");
    expect(result!.user.lastName).toBe("Smith");
    expect(result!.user.plan).toBe("pro");
    expect(result!.user._id).toBe(userId);
    expect(result!.token).toBeTruthy();
    expect(typeof result!.token).toBe("string");
    expect(result!.token.split(".")).toHaveLength(3);
    expect(result!.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should return null when session token is not found", async () => {
    const t = convexTest({ schema, modules });

    const result = await t.query(internal.session.getSession, {
      token: "non-existent-token",
    });

    expect(result).toBeNull();
  });

  it("should return null when session is expired", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "bob@example.com",
        firstName: "Bob",
        lastName: "Jones",
        plan: "free",
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", {
        token: "expired-token",
        userId,
        expiresAt: past(60),
      });
    });

    const result = await t.query(internal.session.getSession, { token: "expired-token" });

    expect(result).toBeNull();
  });

  it("should return null when the session user no longer exists", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "carol@example.com",
        firstName: "Carol",
        lastName: "Brown",
        plan: "free",
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", {
        token: "orphaned-session",
        userId,
        expiresAt: future(3600),
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.delete(userId);
    });

    const result = await t.query(internal.session.getSession, { token: "orphaned-session" });

    expect(result).toBeNull();
  });
});

describe("deleteSession", () => {
  it("should delete an existing session", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "dave@example.com",
        firstName: "Dave",
        lastName: "Wilson",
        plan: "free",
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", {
        token: "delete-me",
        userId,
        expiresAt: future(3600),
      });
    });

    const result = await t.mutation(internal.session.deleteSession, { token: "delete-me" });

    expect(result).toBeNull();
    const session = await t.run(async (ctx) => {
      return await ctx.db
        .query("sessions")
        .withIndex("by_token", (q) => q.eq("token", "delete-me"))
        .first();
    });
    expect(session).toBeNull();
  });

  it("should be a no-op for a non-existent session", async () => {
    const t = convexTest({ schema, modules });

    const result = await t.mutation(internal.session.deleteSession, {
      token: "does-not-exist",
    });

    expect(result).toBeNull();
  });
});
