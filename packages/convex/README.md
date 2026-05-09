# `@repo/convex`

Backend package for the project.

It contains the Convex schema, queries/mutations/actions, auth middleware, HTTP routes, and backend integrations (throttler, email, PostHog, Stripe).

## Purpose

- Own all backend business logic in one place.
- Expose typed Convex APIs to the rest of the monorepo.
- Keep auth, validation, and middleware patterns consistent across functions.

## Tech and conventions

- **Runtime:** Convex (`convex` package)
- **Validation:** Convex validators (`convex/values`) and valibot (`env.ts`)
- **Auth integration:** `@repo/auth/convex`
- **Component integrations:** `@convex-dev/rate-limiter`, `@convex-dev/resend`, `@posthog/convex`
- **Email rendering:** `@react-email/components` and `@react-email/render`
- **Testing:** `convex-test` with Vitest (`vite-plus/test`)
- **Monorepo toolchain:** Vite+ (`vp` commands)

## Project structure

```txt
packages/convex/
  src/
    _generated/         # Convex generated API and data model types (auto-generated)
    auth.config.ts      # Convex Auth configuration (providers, domain)
    auth.ts             # Auth store + route registration (re-exported from @repo/auth/convex)
    auth.test.ts        # Auth module tests
    builder.ts          # Custom chain-based procedure builder
    builder.types.ts    # Builder type system (middleware, context, validators)
    builder.test.ts     # Builder unit tests
    convex.config.ts    # Convex app components (rate limiter, PostHog, resend)
    email.tsx           # Email sending actions (reset-password, change-email, sign-in OTP)
    email.code.tsx      # OTP email template (React Email component)
    env.ts              # Environment variable access with valibot schema validation
    env.test.ts         # Env validation tests
    errors.ts           # Shared typed ConvexError class
    errors.test.ts      # Error tests
    http.ts             # HTTP router registration
    http.test.ts        # HTTP module tests
    middleware.ts       # Auth middleware + pre-configured authQuery/authMutation/authAction builders
    middleware.test.ts  # Middleware tests
    payments.ts         # Stripe client initialization
    payments.test.ts    # Stripe initialization tests
    posthog.ts          # PostHog client initialization
    schema.ts           # Database schema, tables, and indexes
    throttler.ts        # Throttler (rate limiter) policies
    throttler.test.ts   # Throttler tests
    user.ts             # Example domain function (getUser)
    user.test.ts        # User function tests
    tsconfig.json       # TypeScript configuration
  convex.json           # Convex package config (functions root set to src)
```

## Quick start

From the repository root:

```bash
vp install
```

From `packages/convex`:

```bash
vp exec convex dev
```

Useful checks (from repo root):

```bash
vp check
vp test
```

## How backend functions are built here

This package uses a chain-based builder (`src/builder.ts`) for consistent function definitions. The builder supports `.use()`, `.input()`, `.returns()`, `.handler()`, and finalizes with `.public()` or `.internal()`.

Typical flow:

1. Import `convex` (the builder instance) from `./middleware`.
2. Call `.query()`, `.mutation()`, or `.action()` to start a chain.
3. Add middleware with `.use(...)` (for example auth).
4. Add input validation with `.input(...)`.
5. Add return validation with `.returns(...)`.
6. Add implementation with `.handler(...)`.
7. Register visibility with `.public()` or `.internal()`.

Example:

```ts
import { v } from "convex/values";

import { ConvexError } from "./errors";
import { authQuery } from "./middleware";

export const getUser = authQuery
  .returns(
    v.object({
      email: v.string(),
      firstName: v.string(),
      lastName: v.string(),
    }),
  )
  .handler(async (ctx) => {
    const user = await ctx.db.get(ctx.userId);
    if (!user) throw new ConvexError({ code: "INTERNAL_SERVER_ERROR" });
    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  })
  .public();
```

## Builder features

- **Middleware onion model** — middlewares run in declared order, wrapping the handler inside-out (first middleware runs first, handler runs after all before-middleware, then after-middleware unwinds in reverse).
- **Fail-closed** — if a middleware never calls `next`, the handler never runs and an error is thrown.
- **Middleware after handler** — `.use()` can be called after `.handler()`. Middleware added after the handler still executes before the handler at runtime.
- **No handler reassignment** — once `.handler()` is called, the `handler` property is not exposed on the resulting object.
- **Callable** — the builder's intermediate states are callable functions that produce a result, enabling direct invocation in tests.

## Authentication model

- `src/middleware.ts` defines the builder instance (`convex`) and `authMiddleware`.
- `authMiddleware` resolves identity via `ctx.auth.getUserIdentity()`.
- If no identity exists, it throws a `ConvexError` with code `UNAUTHORIZED`.
- Authenticated context includes `ctx.userId` (`Id<"users">`).
- Three pre-configured builders are exported: `authQuery`, `authMutation`, and `authAction` — each starts with `authMiddleware` already `.use()`'d.

## Schema overview

`src/schema.ts` defines:

- Core auth/user tables: `users` (with `email`, `firstName`, `lastName`, `plan`, `verified`), `accounts`, `sessions`, `verifications`
- Billing tables: `customers`, `subscriptions`, `invoices`, `payments`
- `users.plan` is a union of `"free"` and `"pro"`.
- `users.verified` is a boolean.
- Indexed access patterns for email, provider/account, user relations, subscription identifiers, and billing identifiers.

When changing schema:

1. Update `src/schema.ts`.
2. Run `vp exec convex dev` to regenerate types in `src/_generated`.
3. Update dependent functions if types changed.

## HTTP routes

- `src/http.ts` creates a Convex `HttpRouter`.
- `registerRoutes(http)` from `src/auth.ts` mounts auth HTTP endpoints on the router.
- `src/http.ts` is the default export consumed by Convex as the HTTP router.

## Throttling (rate limiting)

`src/throttler.ts` configures `@convex-dev/rate-limiter` with fixed-window policies:

- `oauth`: 20 requests per 60 seconds
- `logout`: 100 requests per 60 seconds

The throttler is instantiated with the `rateLimiter` component declared in `convex.config.ts`. The throttler instance is exported from the package (`@repo/convex/throttler`).

## Email

`src/email.tsx` provides a single internal action using `@convex-dev/resend` and `@react-email/render`:

- `sendWelcomeEmail` — sends a welcome email after user sign-up

It accepts `{ to: string, firstName: string }` and returns the Resend email ID. In non-production environments, emails are sent to `delivery@resend.dev` (Resend test mode). The welcome template (`src/email.code.tsx`) is a React Email component rendered with Tailwind CSS.

## PostHog

`src/posthog.ts` initializes a `PostHog` client from `@posthog/convex` using the `posthog` component declared in `convex.config.ts`.

## Environment variables

`src/env.ts` validates all required environment variables at module load time using a valibot schema. The parsed, typed `env` object is exported for use across the package. Required variables include:

- Apple and Google OAuth credentials
- Auth secret, JWKS public key
- Dashboard and marketing URLs
- Deploy environment (`"development"` | `"production"`)
- Resend API key
- Stripe secret and webhook secret keys

## Errors

`src/errors.ts` exports a `ConvexError` class that wraps Convex's `ConvexError` with a typed error code system. Error codes include standard HTTP-semantic codes such as `UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`, `TOO_MANY_REQUESTS`, and others. The error message defaults to the code name when not explicitly provided.

## Testing

Tests use `convex-test` for integration tests (with a real Convex runtime) and Vitest (via `vite-plus/test`) for unit tests with mocked dependencies. Import test utilities from `vite-plus/test`:

```ts
import { describe, expect, it, vi } from "vite-plus/test";
```

For integration tests against a real Convex backend, use `convexTest`:

```ts
import { convexTest } from "convex-test";
const t = convexTest({ schema, modules });
const result = await t.run(async (ctx) => {
  /* ... */
});
```

## How to add a new backend function

1. Pick or create a domain file under `src/` (for example `billing.ts`).
2. Choose the right wrapper:
   - `authQuery` / `authMutation` / `authAction` for protected endpoints (from `./middleware`)
   - `convex.query()` / `convex.mutation()` / `convex.action()` for custom chains (from `./middleware`)
3. Define `.input(...)` and `.returns(...)` validators as needed.
4. Implement `.handler(...)` with business logic.
5. End with `.public()` or `.internal()`.
6. Run `vp exec convex dev` and ensure generated types are updated.
7. Run `vp check` and `vp test` before opening a PR.
