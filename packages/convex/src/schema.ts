import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro")),
  }).index("by_email", ["email"]),

  accounts: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("apple"), v.literal("google")),
    accountId: v.string(),
  })
    .index("by_provider_account", ["provider", "accountId"])
    .index("by_user", ["userId"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  verifications: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
  })
    .index("by_identifier", ["identifier"])
    .index("by_expires_at", ["expiresAt"]),

  customers: defineTable({
    userId: v.id("users"),
    customerId: v.string(),
    email: v.string(),
  })
    .index("by_customer", ["customerId"])
    .index("by_email", ["email"])
    .index("by_user", ["userId"]),

  subscriptions: defineTable({
    userId: v.id("users"),
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
    cancelAtPeriodEnd: v.boolean(),
    cancelAt: v.optional(v.number()),
  })
    .index("by_subscription", ["subscriptionId"])
    .index("by_customer", ["customerId"])
    .index("by_user", ["userId"]),

  invoices: defineTable({
    userId: v.id("users"),
    customerId: v.string(),
    subscriptionId: v.string(),
    invoiceId: v.string(),
    amountDue: v.number(),
    amountPaid: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("paid"),
      v.literal("uncollectible"),
      v.literal("void"),
    ),
    issuedAt: v.number(),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_user", ["userId"]),

  payments: defineTable({
    userId: v.id("users"),
    customerId: v.string(),
    paymentId: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("requires_payment_method"),
      v.literal("requires_confirmation"),
      v.literal("requires_action"),
      v.literal("processing"),
      v.literal("succeeded"),
      v.literal("canceled"),
    ),
    processedAt: v.number(),
  })
    .index("by_payment", ["paymentId"])
    .index("by_user", ["userId"]),
});
