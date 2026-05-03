/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { GenericId, v } from "convex/values";
import { describe, expect, it } from "vite-plus/test";

const schema = defineSchema({
  users: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro")),
    verified: v.boolean(),
  }),
});

const modules = import.meta.glob("./**/*.ts");

describe("getUser", () => {
  it("should return user data when user exists", async () => {
    const t = convexTest({
      schema,
      modules,
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        plan: "free",
        verified: true,
      });
    });

    const user = await t.run(async (ctx) => ctx.db.get(userId));

    expect(user).toBeDefined();
    expect(user?.email).toBe("test@example.com");
    expect(user?.firstName).toBe("John");
  });

  it("should handle missing user", async () => {
    const t = convexTest({
      schema,
      modules,
    });

    const user = await t.run(async (ctx) => ctx.db.get("invalid_id" as GenericId<"users">));

    expect(user).toBeNull();
  });
});
