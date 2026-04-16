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
  crpc: {
    auth: {
      getJwks: FunctionReference<"action", "internal", {}, any>;
      mutationAdapter: FunctionReference<
        "mutation",
        "internal",
        {
          input: any;
          op:
            | "create"
            | "updateOne"
            | "updateMany"
            | "deleteOne"
            | "deleteMany";
          select?: Array<string>;
        },
        any
      >;
      queryAdapter: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          model: string;
          offset?: number;
          op: "findOne" | "findMany";
          select?: Array<string>;
          sortBy?: { direction: "asc" | "desc"; field: string };
          where?: Array<any>;
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
