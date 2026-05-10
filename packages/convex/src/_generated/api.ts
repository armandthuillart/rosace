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
    mutation: FunctionReference<
      "mutation",
      "internal",
      {
        payload:
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
  customer: {
    handleCustomerCreatedOrUpdated: FunctionReference<
      "mutation",
      "internal",
      { customerId: string; email: string; metadata: { userId: Id<"users"> } },
      null
    >;
  };
  session: {
    getSession: FunctionReference<
      "query",
      "internal",
      { token: string },
      {
        expiresAt: number;
        token: string;
        user: {
          _creationTime: number;
          _id: Id<"users">;
          email: string;
          firstName: string;
          lastName: string;
          plan: "free" | "pro";
        };
      } | null
    >;
  };
  subscription: {
    handleSubscriptionCreated: FunctionReference<
      "mutation",
      "internal",
      {
        cancelsAt?: number;
        cancelsAtPeriodEnd: boolean;
        currentPeriodEndsAt: number;
        customerId: string;
        metadata: { userId: Id<"users"> };
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
      },
      null
    >;
  };
} = anyApi as any;

export const components = componentsGeneric() as unknown as {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  posthog: import("@posthog/convex/_generated/component.js").ComponentApi<"posthog">;
};
