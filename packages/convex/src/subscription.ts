import { v } from "convex/values";
import { mutation } from "./middleware";

export const handleSubscriptionCreated = mutation
  .input(
    v.object({
      customerId: v.string(),
      subscriptionId: v.string(),
      productId: v.string(),
      priceId: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("canceled"),
        v.literal("incomplete"),
        v.literal("incomplete_expired"),
        v.literal("past_due"),
        v.literal("trialing"),
        v.literal("unpaid"),
        v.literal("paused"),
      ),
      currentPeriodEndsAt: v.number(),
      cancelsAtPeriodEnd: v.boolean(),
      cancelsAt: v.optional(v.number()),
      metadata: v.object({ userId: v.id("users") }),
    }),
  )
  .returns(v.null())
  .handler(async (ctx, args) => {
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", args.subscriptionId))
      .unique();

    const userId = args.metadata.userId;

    if (!existingSubscription) {
      await ctx.db.insert("subscriptions", {
        subscriptionId: args.subscriptionId,
        customerId: args.customerId,
        status: args.status,
        currentPeriodEndsAt: args.currentPeriodEndsAt,
        cancelsAtPeriodEnd: args.cancelsAtPeriodEnd,
        productId: args.productId,
        cancelsAt: args.cancelsAt ?? undefined,
        priceId: args.priceId,
        userId: userId,
      });
    }

    if (userId) {
      const invoices = await ctx.db
        .query("invoices")
        .withIndex("by_subscription", (q) => q.eq("subscriptionId", args.subscriptionId))
        .collect();

      for (const invoice of invoices) {
        if (!invoice.userId) {
          await ctx.db.patch(invoice._id, {
            ...(userId && !invoice.userId && { userId }),
          });
        }
      }
    }

    return null;
  })
  .internal();
