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
    storeMutation: FunctionReference<
      "mutation",
      "internal",
      {
        payload:
          | {
              email: string;
              firstName?: string;
              flow: "register" | "login";
              lastName?: string;
              password: string;
              type: "credentials";
            }
          | { token: string; type: "session:delete" }
          | {
              expiresAt: number;
              nonce: string;
              provider: "apple" | "google";
              state: string;
              type: "oauth:start";
              verifier?: string;
            }
          | {
              provider: "apple" | "google";
              state: string;
              type: "oauth:consume";
            }
          | {
              email: string;
              firstName: string;
              lastName: string;
              provider: "apple" | "google";
              subject: string;
              type: "oauth:complete";
              verified: boolean;
            }
          | {
              accessToken: string;
              expiresAt: number;
              sessionToken: string;
              type: "oauth:handoff:issue";
            }
          | { code: string; type: "oauth:handoff:claim" };
      },
      any
    >;
    storeQuery: FunctionReference<
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
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
