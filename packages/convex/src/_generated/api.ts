/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";
import type { GenericId as Id } from "convex/values";
import { anyApi, componentsGeneric } from "convex/server";

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: {
  user: {
    getUser: FunctionReference<
      "query",
      "public",
      {},
      { email: string; name: string }
    >;
  };
} = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: {
  _crpc: {
    adapter: {
      crpcMutation: FunctionReference<
        "mutation",
        "internal",
        {
          input: any;
          op: "insert" | "updateOne" | "updateMany" | "remove" | "removeMany";
          select?: Array<string>;
        },
        any
      >;
      crpcQuery: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          model: string;
          offset?: number;
          op: "findOne" | "findMany" | "count";
          select?: Array<string>;
          sortBy?: { direction: "asc" | "desc"; field: string };
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            operator?:
              | "contains"
              | "ends_with"
              | "eq"
              | "gt"
              | "gte"
              | "in"
              | "lt"
              | "lte"
              | "ne"
              | "not_in"
              | "starts_with";
            value: any;
          }>;
        },
        any
      >;
    };
  };
  email: {
    changeEmail: FunctionReference<
      "action",
      "internal",
      { otp: string; to: string },
      string
    >;
    resetPassword: FunctionReference<
      "action",
      "internal",
      { otp: string; to: string },
      string
    >;
    sendOtp: FunctionReference<
      "action",
      "internal",
      { otp: string; to: string },
      string
    >;
  };
} = anyApi as any;

export const components = componentsGeneric() as unknown as {
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
