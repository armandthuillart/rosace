import { describe, expect, it } from "vite-plus/test";
import { convexTest } from "convex-test";

import schema from "./schema";
import { handleSubscriptionCreated } from "./subscription";

const modules = {
  "./_generated/api.ts": () => Promise.resolve({}),
};

describe("handleSubscriptionCreated", () => {
  it("should insert a new subscription", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        plan: "pro",
      });
    });

    await t.mutation(handleSubscriptionCreated as any, {
      customerId: "cus_abc",
      subscriptionId: "sub_123",
      productId: "prod_x",
      priceId: "price_y",
      status: "active",
      currentPeriodEndsAt: 1_800_000_000_000,
      cancelsAtPeriodEnd: false,
      cancelsAt: undefined,
      metadata: { userId },
    });

    const sub = await t.run(async (ctx) => {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_subscription", (q) => q.eq("subscriptionId", "sub_123"))
        .unique();
    });
    expect(sub).not.toBeNull();
    expect(sub!.subscriptionId).toBe("sub_123");
    expect(sub!.customerId).toBe("cus_abc");
    expect(sub!.productId).toBe("prod_x");
    expect(sub!.priceId).toBe("price_y");
    expect(sub!.status).toBe("active");
    expect(sub!.currentPeriodEndsAt).toBe(1_800_000_000_000);
    expect(sub!.cancelsAtPeriodEnd).toBe(false);
    expect(sub!.cancelsAt).toBeUndefined();
    expect(sub!.userId).toBe(userId);
  });

  it("should insert a subscription with optional cancelsAt", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "bob@example.com",
        firstName: "Bob",
        lastName: "Jones",
        plan: "free",
      });
    });

    await t.mutation(handleSubscriptionCreated as any, {
      customerId: "cus_def",
      subscriptionId: "sub_456",
      productId: "prod_a",
      priceId: "price_b",
      status: "trialing",
      currentPeriodEndsAt: 1_900_000_000_000,
      cancelsAtPeriodEnd: true,
      cancelsAt: 1_950_000_000_000,
      metadata: { userId },
    });

    const sub = await t.run(async (ctx) => {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_subscription", (q) => q.eq("subscriptionId", "sub_456"))
        .unique();
    });
    expect(sub!.cancelsAt).toBe(1_950_000_000_000);
    expect(sub!.cancelsAtPeriodEnd).toBe(true);
  });

  it("should not insert a duplicate subscription", async () => {
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
      await ctx.db.insert("subscriptions", {
        subscriptionId: "sub_dup",
        customerId: "cus_dup",
        status: "active",
        currentPeriodEndsAt: 1_800_000_000_000,
        cancelsAtPeriodEnd: false,
        productId: "prod_orig",
        priceId: "price_orig",
        userId,
      });
    });

    await t.mutation(handleSubscriptionCreated as any, {
      subscriptionId: "sub_dup",
      customerId: "cus_dup",
      status: "active",
      currentPeriodEndsAt: 1_800_000_000_000,
      cancelsAtPeriodEnd: false,
      productId: "prod_new",
      priceId: "price_new",
      metadata: { userId },
    });

    const subs = await t.run(async (ctx) => {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_subscription", (q) => q.eq("subscriptionId", "sub_dup"))
        .collect();
    });
    expect(subs).toHaveLength(1);
    expect(subs[0].productId).toBe("prod_orig");
  });

  it("should leave existing invoices unchanged when they already have a userId", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "dave@example.com",
        firstName: "Dave",
        lastName: "Wilson",
        plan: "free",
      });
    });
    const invoiceUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "invoice-owner@example.com",
        firstName: "Original",
        lastName: "Owner",
        plan: "free",
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("invoices", {
        invoiceId: "inv_1",
        subscriptionId: "sub_patch",
        customerId: "cus_patch",
        amountDue: 1000,
        amountPaid: 1000,
        status: "paid",
        issuedAt: 1_700_000_000_000,
        userId: invoiceUserId,
      });
    });

    await t.mutation(handleSubscriptionCreated as any, {
      subscriptionId: "sub_patch",
      customerId: "cus_patch",
      productId: "prod_p",
      priceId: "price_p",
      status: "active",
      currentPeriodEndsAt: 1_800_000_000_000,
      cancelsAtPeriodEnd: false,
      metadata: { userId },
    });

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("invoices")
        .withIndex("by_subscription", (q) => q.eq("subscriptionId", "sub_patch"))
        .collect();
    });
    expect(invoices).toHaveLength(1);
    expect(invoices[0].userId).toBe(invoiceUserId);
  });

  it("should return null", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "eve@example.com",
        firstName: "Eve",
        lastName: "Adams",
        plan: "pro",
      });
    });

    const result = await t.mutation(handleSubscriptionCreated as any, {
      subscriptionId: "sub_null",
      customerId: "cus_null",
      productId: "prod_n",
      priceId: "price_n",
      status: "active",
      currentPeriodEndsAt: 1_800_000_000_000,
      cancelsAtPeriodEnd: false,
      metadata: { userId },
    });

    expect(result).toBeNull();
  });
});
