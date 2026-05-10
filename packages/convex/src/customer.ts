import { mutation } from "./middleware";
import { v } from "convex/values";

export const handleCustomerCreatedOrUpdated = mutation
  .input(
    v.object({
      customerId: v.string(),
      email: v.string(),
      metadata: v.object({ userId: v.id("users") }),
    }),
  )
  .returns(v.null())
  .handler(async (ctx, args) => {
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .unique();

    if (!existingCustomer) {
      await ctx.db.insert("customers", {
        customerId: args.customerId,
        userId: args.metadata.userId,
        email: args.email,
      });
    }

    if (existingCustomer) {
      await ctx.db.patch(existingCustomer._id, {
        email: args.email,
      });
    }

    return null;
  })
  .internal();

export const createOrUpdateCustomer = mutation
  .input(
    v.object({
      customerId: v.string(),
      email: v.string(),
      metadata: v.object({ userId: v.id("users") }),
    }),
  )
  .returns(v.string())
  .handler(async (ctx, args) => {
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .unique();

    if (!existingCustomer) {
      await ctx.db.insert("customers", {
        customerId: args.customerId,
        email: args.email,
        userId: args.metadata.userId,
      });
    } else {
      await ctx.db.patch(existingCustomer._id, {
        email: args.email,
        userId: args.metadata.userId,
      });
    }

    return args.customerId;
  });
