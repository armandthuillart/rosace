/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
  AnyDataModel,
} from "convex/server";
import type { GenericId } from "convex/values";

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like `queryGeneric` and
 * `mutationGeneric` to make them type-safe.
 */

export type DataModel = {
  accounts: {
    document: {
      accessToken?: string;
      accessTokenExpiresAt?: number;
      accountId: string;
      password?: string;
      provider: "apple" | "credentials" | "google";
      refreshToken?: string;
      userId: Id<"users">;
      _id: Id<"accounts">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "accessToken"
      | "accessTokenExpiresAt"
      | "accountId"
      | "password"
      | "provider"
      | "refreshToken"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_provider_account: ["provider", "accountId", "_creationTime"];
      by_user: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  customers: {
    document: {
      customerId: string;
      email: string;
      userId: Id<"users">;
      _id: Id<"customers">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "customerId" | "email" | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_customer: ["customerId", "_creationTime"];
      by_email: ["email", "_creationTime"];
      by_user: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  invoices: {
    document: {
      amountDue: number;
      amountPaid: number;
      customerId: string;
      invoiceId: string;
      issuedAt: number;
      status: "draft" | "open" | "paid" | "uncollectible" | "void";
      subscriptionId: string;
      userId: Id<"users">;
      _id: Id<"invoices">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "amountDue"
      | "amountPaid"
      | "customerId"
      | "invoiceId"
      | "issuedAt"
      | "status"
      | "subscriptionId"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_invoice: ["invoiceId", "_creationTime"];
      by_user: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  payments: {
    document: {
      amount: number;
      currency: string;
      customerId: string;
      paymentId: string;
      processedAt: number;
      status:
        | "requires_payment_method"
        | "requires_confirmation"
        | "requires_action"
        | "processing"
        | "succeeded"
        | "canceled";
      userId: Id<"users">;
      _id: Id<"payments">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "amount"
      | "currency"
      | "customerId"
      | "paymentId"
      | "processedAt"
      | "status"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_payment: ["paymentId", "_creationTime"];
      by_user: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  sessions: {
    document: {
      expiresAt: number;
      token: string;
      userId: Id<"users">;
      _id: Id<"sessions">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "expiresAt" | "token" | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_token: ["token", "_creationTime"];
      by_user: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  subscriptions: {
    document: {
      cancelAt?: number;
      cancelAtPeriodEnd: boolean;
      currentPeriodEndsAt: number;
      customerId: string;
      priceId: string;
      productId: string;
      status:
        | "active"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "past_due"
        | "trialing"
        | "unpaid"
        | "paused";
      subscriptionId: string;
      userId: Id<"users">;
      _id: Id<"subscriptions">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "cancelAt"
      | "cancelAtPeriodEnd"
      | "currentPeriodEndsAt"
      | "customerId"
      | "priceId"
      | "productId"
      | "status"
      | "subscriptionId"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_customer: ["customerId", "_creationTime"];
      by_subscription: ["subscriptionId", "_creationTime"];
      by_user: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  users: {
    document: {
      email: string;
      emailVerified: boolean;
      firstName: string;
      lastName: string;
      plan: "free" | "pro";
      _id: Id<"users">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "email"
      | "emailVerified"
      | "firstName"
      | "lastName"
      | "plan";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_email: ["email", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  verifications: {
    document: {
      expiresAt: number;
      identifier: string;
      value: string;
      _id: Id<"verifications">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "expiresAt" | "identifier" | "value";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_expires: ["expiresAt", "_creationTime"];
      by_identifier: ["identifier", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
};

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
 *
 * Documents can be loaded using `db.get(tableName, id)` in query and mutation functions.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;
