# `@repo/convex`

Convex backend for Rosace.

This package owns the project’s backend source of truth:

- schema, indexes, and generated types
- authenticated queries, mutations, and actions
- HTTP routes and auth route registration
- integrations for rate limiting, email, PostHog, and Stripe

## Why

Rosace keeps backend logic in one place so the rest of the monorepo can stay thin.

That gives us:

- typed Convex APIs everywhere
- consistent auth and error handling
- one place for validation, middleware, and external service clients
- a clear boundary between domain logic and the UI

## What lives here

- `src/schema.ts` — database schema for auth, billing, and user data
- `src/middleware.ts` — auth middleware plus preconfigured `authQuery`, `authMutation`, and `authAction`
- `src/builder.ts` — custom chain-based procedure builder
- `src/http.ts` — Convex HTTP router entrypoint
- `src/auth.ts` / `src/auth.config.ts` — auth integration and route registration
- `src/env.ts` — environment variable parsing and validation
- `src/errors.ts` — typed `ConvexError`
- `src/email.tsx` / `src/email.code.tsx` — email actions and templates
- `src/payments.ts` — Stripe client setup
- `src/posthog.ts` — PostHog client setup
- `src/throttler.ts` — rate-limit policies

## Conventions

- Use `convex/values` for procedure inputs and outputs.
- Use `authQuery`, `authMutation`, and `authAction` for protected functions.
- Put shared middleware on the builder instead of duplicating checks inside handlers.
- Validate environment variables in `src/env.ts` at module load time.
- Throw typed `ConvexError` values for predictable failures.

## Development

From the repository root:

```bash
vp install
vp check
vp test
```

To work on this package directly:

```bash
vp exec convex dev
```

## Testing

Use:

- `convex-test` for integration tests against a real Convex runtime
- `vite-plus/test` for unit tests and mocks

Example imports:

```ts
import { describe, expect, it, vi } from "vite-plus/test";
```

## Schema changes

When you change `src/schema.ts`:

1. update the schema
2. run `vp exec convex dev` to regenerate `src/_generated`
3. update any affected functions and tests

## Adding a new function

1. Pick a domain file under `src/`.
2. Choose `authQuery` / `authMutation` / `authAction` for protected endpoints, or the base builder for custom chains.
3. Add input and return validators as needed.
4. Implement the handler.
5. End with `.public()` or `.internal()`.
6. Run `vp check` and `vp test`.
