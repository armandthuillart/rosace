import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  accounts: defineTable({
    accessToken: v.optional(v.union(v.null(), v.string())),
    accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    accountId: v.string(),
    idToken: v.optional(v.union(v.null(), v.string())),
    password: v.optional(v.union(v.null(), v.string())),
    providerId: v.string(),
    refreshToken: v.optional(v.union(v.null(), v.string())),
    refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    scope: v.optional(v.union(v.null(), v.string())),
    updatedAt: v.number(),
    userId: v.string(),
  })
    .index("by_account", ["accountId"])
    .index("by_account_provider", ["accountId", "providerId"])
    .index("by_provider_user", ["providerId", "userId"])
    .index("by_user", ["userId"]),
  customers: defineTable({
    customerId: v.string(),
    email: v.string(),
    metadata: v.optional(v.any()),
    name: v.optional(v.string()),
    userId: v.string(),
  })
    .index("by_customer", ["customerId"])
    .index("by_email", ["email"])
    .index("by_user", ["userId"]),
  invoices: defineTable({
    amountDue: v.number(),
    amountPaid: v.number(),
    createdAt: v.number(),
    customerId: v.string(),
    invoiceId: v.string(),
    status: v.string(),
    subscriptionId: v.string(),
    userId: v.string(),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_customer", ["customerId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_user", ["userId"]),
  payments: defineTable({
    amount: v.number(),
    createdAt: v.number(),
    currency: v.string(),
    customerId: v.string(),
    metadata: v.optional(v.any()),
    paymentId: v.string(),
    status: v.string(),
    userId: v.string(),
  })
    .index("by_payment", ["paymentId"])
    .index("by_customer", ["customerId"])
    .index("by_user", ["userId"]),
  sessions: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    updatedAt: v.number(),
    userId: v.string(),
  })
    .index("by_expires_at", ["expiresAt"])
    .index("by_expires_at_user", ["expiresAt", "userId"])
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),
  subscriptions: defineTable({
    cancelAt: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.number(),
    customerId: v.string(),
    priceId: v.string(),
    status: v.string(),
    subscriptionId: v.string(),
    userId: v.string(),
  })
    .index("by_subscription", ["subscriptionId"])
    .index("by_user", ["userId"])
    .index("by_customer", ["customerId"]),
  users: defineTable({
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.string(),
    updatedAt: v.number(),
  })
    .index("by_email_name", ["email", "name"])
    .index("by_name", ["name"]),
  verifications: defineTable({
    expiresAt: v.number(),
    identifier: v.string(),
    updatedAt: v.number(),
    value: v.string(),
  })
    .index("by_expires_at", ["expiresAt"])
    .index("by_identifier", ["identifier"]),
});
