import { describe, expect, it } from "vite-plus/test";
import { convexTest } from "convex-test";

import schema from "./schema";
import { internal } from "./_generated/api";

// @ts-expect-error - modules are loaded dynamically
const modules = import.meta.glob("./**/*.ts");

describe("handleCustomerCreatedOrUpdated", () => {
  it("should insert a new customer when one does not exist", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        plan: "free",
      });
    });

    await t.mutation(internal.customer.handleCustomerCreatedOrUpdated, {
      customerId: "cus_abc123",
      email: "alice@example.com",
      metadata: { userId },
    });

    const customer = await t.run(async (ctx) => {
      return await ctx.db
        .query("customers")
        .withIndex("by_customer", (q) => q.eq("customerId", "cus_abc123"))
        .unique();
    });
    expect(customer).not.toBeNull();
    expect(customer!.customerId).toBe("cus_abc123");
    expect(customer!.email).toBe("alice@example.com");
    expect(customer!.userId).toBe(userId);
  });

  it("should update the email of an existing customer", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "bob@example.com",
        firstName: "Bob",
        lastName: "Jones",
        plan: "pro",
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("customers", {
        customerId: "cus_existing",
        email: "old@example.com",
        userId,
      });
    });

    await t.mutation(internal.customer.handleCustomerCreatedOrUpdated, {
      customerId: "cus_existing",
      email: "new@example.com",
      metadata: { userId },
    });

    const customer = await t.run(async (ctx) => {
      return await ctx.db
        .query("customers")
        .withIndex("by_customer", (q) => q.eq("customerId", "cus_existing"))
        .unique();
    });
    expect(customer).not.toBeNull();
    expect(customer!.email).toBe("new@example.com");
  });

  it("should return null", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "carol@example.com",
        firstName: "Carol",
        lastName: "Brown",
        plan: "free",
      });
    });

    const result = await t.mutation(internal.customer.handleCustomerCreatedOrUpdated, {
      customerId: "cus_null",
      email: "carol@example.com",
      metadata: { userId },
    });

    expect(result).toBeNull();
  });
});

describe("createOrUpdateCustomer", () => {
  it("should insert a new customer and return the customerId", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "dave@example.com",
        firstName: "Dave",
        lastName: "Wilson",
        plan: "free",
      });
    });

    const result = await t.mutation(internal.customer.createOrUpdateCustomer, {
      customerId: "cus_new",
      email: "dave@example.com",
      metadata: { userId },
    });

    expect(result).toBe("cus_new");
    const customer = await t.run(async (ctx) => {
      return await ctx.db
        .query("customers")
        .withIndex("by_customer", (q) => q.eq("customerId", "cus_new"))
        .unique();
    });
    expect(customer).not.toBeNull();
    expect(customer!.email).toBe("dave@example.com");
  });

  it("should update an existing customer and return the customerId", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "eve@example.com",
        firstName: "Eve",
        lastName: "Adams",
        plan: "pro",
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("customers", {
        customerId: "cus_update",
        email: "original@example.com",
        userId,
      });
    });

    const result = await t.mutation(internal.customer.createOrUpdateCustomer, {
      customerId: "cus_update",
      email: "updated@example.com",
      metadata: { userId },
    });

    expect(result).toBe("cus_update");
    const customer = await t.run(async (ctx) => {
      return await ctx.db
        .query("customers")
        .withIndex("by_customer", (q) => q.eq("customerId", "cus_update"))
        .unique();
    });
    expect(customer!.email).toBe("updated@example.com");
  });
});
