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
      accessToken?: null | string;
      accessTokenExpiresAt?: null | number;
      accountId: string;
      idToken?: null | string;
      password?: null | string;
      providerId: string;
      refreshToken?: null | string;
      refreshTokenExpiresAt?: null | number;
      scope?: null | string;
      updatedAt: number;
      userId: string;
      _id: Id<"accounts">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "accessToken"
      | "accessTokenExpiresAt"
      | "accountId"
      | "idToken"
      | "password"
      | "providerId"
      | "refreshToken"
      | "refreshTokenExpiresAt"
      | "scope"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_account: ["accountId", "_creationTime"];
      by_account_provider: ["accountId", "providerId", "_creationTime"];
      by_provider_user: ["providerId", "userId", "_creationTime"];
      by_user: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  customers: {
    document: {
      customerId: string;
      email: string;
      metadata?: any;
      name?: string;
      userId: string;
      _id: Id<"customers">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "customerId" | "email" | "metadata" | "name" | "userId";
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
      createdAt: number;
      customerId: string;
      invoiceId: string;
      status: string;
      subscriptionId: string;
      userId: string;
      _id: Id<"invoices">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "amountDue"
      | "amountPaid"
      | "createdAt"
      | "customerId"
      | "invoiceId"
      | "status"
      | "subscriptionId"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_customer: ["customerId", "_creationTime"];
      by_invoice: ["invoiceId", "_creationTime"];
      by_subscription: ["subscriptionId", "_creationTime"];
      by_user: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  payments: {
    document: {
      amount: number;
      createdAt: number;
      currency: string;
      customerId: string;
      metadata?: any;
      paymentId: string;
      status: string;
      userId: string;
      _id: Id<"payments">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "amount"
      | "createdAt"
      | "currency"
      | "customerId"
      | "metadata"
      | "paymentId"
      | "status"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_customer: ["customerId", "_creationTime"];
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
      updatedAt: number;
      userId: string;
      _id: Id<"sessions">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "expiresAt" | "token" | "updatedAt" | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_expires_at: ["expiresAt", "_creationTime"];
      by_expires_at_user: ["expiresAt", "userId", "_creationTime"];
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
      currentPeriodEnd: number;
      customerId: string;
      priceId: string;
      status: string;
      subscriptionId: string;
      userId: string;
      _id: Id<"subscriptions">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "cancelAt"
      | "cancelAtPeriodEnd"
      | "currentPeriodEnd"
      | "customerId"
      | "priceId"
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
      name: string;
      updatedAt: number;
      _id: Id<"users">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "email" | "emailVerified" | "name" | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_email_name: ["email", "name", "_creationTime"];
      by_name: ["name", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  verifications: {
    document: {
      expiresAt: number;
      identifier: string;
      updatedAt: number;
      value: string;
      _id: Id<"verifications">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "expiresAt" | "identifier" | "updatedAt" | "value";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_expires_at: ["expiresAt", "_creationTime"];
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
export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;

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
export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;
