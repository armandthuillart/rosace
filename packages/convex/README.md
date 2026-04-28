# `@repo/convex`

Backend package for the project.

It contains the Convex schema, queries/mutations/actions, auth HTTP routes, and backend integrations (rate limiter, email, Stripe-related data models).

## Purpose

- Own all backend business logic in one place.
- Expose typed Convex APIs to the rest of the monorepo.
- Keep auth, validation, and middleware patterns consistent across functions.

## Tech and conventions

- **Runtime:** Convex (`convex` package)
- **Validation:** Convex validators (`convex/values`)
- **Auth integration:** `@repo/auth/convex`
- **Component integrations:** `@convex-dev/rate-limiter`, `@convex-dev/resend`
- **Monorepo toolchain:** Vite+ (`vp` commands)

## Project structure

```txt
packages/convex/
  src/
    _generated/         # Convex generated API and data model types
    auth.config.ts      # Auth provider and auth config
    auth.ts             # Auth wrappers + route registration exports
    convex.config.ts    # Convex app components (rate limiter, resend)
    email*.tsx          # Email templates / render helpers
    env.ts              # Environment variable access
    http.ts             # HTTP router registration
    limiter.ts          # Rate limiter policies
    rpc.ts              # Typed builder + auth middleware entrypoints
    schema.ts           # Database schema and indexes
    stripe.ts           # Stripe-related backend logic
    user.ts             # Example domain function (`getUser`)
  procedures/
    index.ts            # Custom chain builder implementation
    types.ts            # Builder type system
    errors.ts           # Shared typed backend errors
  convex.json           # Convex package config
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

This package uses a chain-based builder (`procedures/index.ts`) for consistent function definitions.

Typical flow:

1. Start with `convex.query()`, `convex.mutation()`, or `convex.action()`.
2. Add middleware with `.use(...)` (for example auth).
3. Add input validation with `.input(...)`.
4. Add return validation with `.returns(...)`.
5. Add implementation with `.handler(...)`.
6. Register visibility with `.public()` or `.internal()`.

Example:

```ts
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
    return { email: user.email, firstName: user.firstName, lastName: user.lastName };
  })
  .public();
```

## Authentication model

- `src/rpc.ts` defines `authMiddleware`.
- `authMiddleware` resolves identity via `ctx.auth.getUserIdentity()`.
- If no identity exists, the function throws an auth error.
- Authenticated context includes `ctx.userId` (`Id<"users">`).
- Use `authQuery`, `authMutation`, and `authAction` for endpoints that require login.

## Schema overview

`src/schema.ts` defines:

- Core auth/user tables: `users`, `accounts`, `sessions`, `verifications`
- Billing tables: `customers`, `subscriptions`, `invoices`, `payments`
- Indexed access patterns for email, provider/subject, user relations, and billing identifiers

When changing schema:

1. Update `src/schema.ts`.
2. Run `vp exec convex dev` to regenerate types in `src/_generated`.
3. Update dependent functions if types changed.

## HTTP routes

- `src/http.ts` creates a Convex `HttpRouter`.
- `registerRoutes(http)` from `src/auth.ts` mounts auth HTTP endpoints.

## Rate limiting

`src/rate.limiter.ts` configures IP-based fixed-window limits for auth flows:

- `login`: 3 requests / 10 seconds
- `oauth`: 20 requests / 60 seconds
- `logout`: 100 requests / 60 seconds

The auth handlers read the client IP from `cf-connecting-ip` first, then the first `x-forwarded-for` entry. When a request is rate-limited, the route returns `429` with `X-Retry-After`.

## How to add a new backend function

1. Pick or create a domain file under `src/` (for example `billing.ts`).
2. Choose the right wrapper:
   - `authQuery` / `authMutation` / `authAction` for protected endpoints
   - `convex.query()` / `convex.mutation()` / `convex.action()` for custom chains
3. Define `.input(...)` and `.returns(...)` validators.
4. Implement `.handler(...)` with business logic.
5. End with `.public()` or `.internal()`.
6. Run `vp exec convex dev` and ensure generated types are updated.
7. Run `vp check` and `vp test` before opening a PR.
