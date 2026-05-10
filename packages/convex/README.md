# `@repo/convex`

Convex backend for Rosace. Schema, authenticated functions, HTTP routes, and integrations — rate limiting, PostHog, Stripe.

## Why custom auth

As of April 2026, [`get-convex/better-auth`](https://github.com/get-convex/better-auth) has bad performance by design.

This package gives that control by keeping the auth source of truth in-house:

- schema, indexes, and generated types
- authenticated queries, mutations, and actions
- HTTP routes and auth route registration
- First-class rate limiting, PostHog, and Stripe integrations

## Endpoint contract

- `GET /.well-known/openid-configuration`:

  Returns OIDC discovery metadata for Convex. It includes `issuer`, `authorization_endpoint`, and `jwks_uri`.

- `GET /.well-known/jwks.json`:

  Returns public keys used to verify RS256-signed JWT access tokens. Convex uses these keys to validate JWT signature, `iss`, and `aud` claims.

- `GET /auth/session`:

  Returns current auth state.
  - Returns `null` when no valid session exists.
  - Returns `{ user, token, expiresAt }` when a valid session exists.

- `POST /auth/logout`:

  Revokes the current refresh session when present. Clears `session:token`. Returns `204`.
  Rate limit: 100 requests / 60 seconds per IP.

- `GET /auth/login/apple`, `GET /auth/login/google`:

  Starts OAuth login. Creates state and nonce. Also creates PKCE values for Google. Stores values, then redirects to provider.
  Rate limit: 20 requests / 60 seconds per IP.

- `GET|POST /auth/callback/{provider}`:

  Completes OAuth login. Validates state, exchanges code, creates or links account, creates session, then issues handoff code.

- `GET /auth/handoff`:

  Consumes handoff code, sets `session:token` cookie, then redirects to `/`.

- `POST /stripe/webhook`:

  Stripe webhook receiver. Verifies signature, dispatches events for customer, subscription, invoice, and payment changes.

## Key namespace

Dispatch keys:

- `internal.session.getSession`:

  Reads a session by token hash. Returns the session user payload or `null`.

- `internal.session.deleteSession`:

  Deletes a session by token hash.

- `internal.oauth.createAuthorizationSession`:

  Stores OAuth state, nonce, and verifier with expiry.

- `internal.oauth.verifyAuthorizationSession`:

  Consumes stored OAuth state one time and checks expiry.

- `internal.oauth.completeAuthorizationSession`:

  Resolves OAuth identity by linking or creating account and user records. Creates session and issues one-time handoff code.

- `internal.oauth.consumeAuthorizationSession`:

  Consumes the handoff code and returns the stored session payload one time.

- `internal.customer.createCustomer`:

  Creates a Stripe customer with idempotency key.

- `internal.customer.createOrUpdateCustomer`:

  Inserts or updates a customer record.

- `internal.subscription.handleSubscriptionCreated`:

  Inserts a new subscription record and patches orphaned invoices.

## Required environment

- `CONVEX_SITE_URL`
- `DASHBOARD_URL`
- `DEPLOY_ENV` (`development` or `production`)
- `JWKS`
- `MARKETING_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

OAuth provider credentials (if enabled):

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Apple: `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`

## CLI

- `vp exec --filter ./packages/convex -- tsx src/cli.ts set`:

  Idempotently creates `JWKS` environment variables on the Convex deployment if they are missing.

- `vp exec --filter ./packages/convex -- tsx src/cli.ts rotate`:

  Overwrites `JWKS` with a new value.

  Add `--prod` to target the production deployment.

## Operational notes

- Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Rate limiting uses `cf-connecting-ip` first, then `x-forwarded-for`.
- Rate-limited responses return `429` with `X-Retry-After`.
- Logout POST routes enforce `Origin === DASHBOARD_URL origin`.
- Authenticated `/auth/session` responses are `Cache-Control: no-store`.
- OIDC and JWKS endpoints: `Cache-Control: public, max-age=3600`.
