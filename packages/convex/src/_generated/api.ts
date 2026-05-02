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
      { email: string; firstName: string; lastName: string }
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
  auth: {
    action: FunctionReference<
      "action",
      "internal",
      {
        payload:
          | { password: string; type: "password:hash" }
          | { hash: string; password: string; type: "password:verify" };
      },
      any
    >;
    mutation: FunctionReference<
      "mutation",
      "internal",
      {
        payload:
          | {
              email: string;
              firstName: string;
              lastName: string;
              password: string;
              type: "credentials:register";
            }
          | { email: string; type: "credentials:login" }
          | { email: string; password: string; type: "credentials:login" }
          | { token: string; type: "session:revoke" }
          | {
              expiresAt: number;
              nonce: string;
              provider: "apple" | "google";
              state: string;
              type: "oauth:authorize";
              verifier?: string;
            }
          | {
              provider: "apple" | "google";
              state: string;
              type: "oauth:verify";
            }
          | {
              accountId: string;
              email: string;
              emailVerified: boolean;
              firstName: string;
              lastName: string;
              provider: "apple" | "google";
              type: "oauth:finalize";
            }
          | { code: string; type: "oauth:claim" };
      },
      any
    >;
    query: FunctionReference<
      "query",
      "internal",
      { payload: { token: string; type: "session:get" } },
      any
    >;
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
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
