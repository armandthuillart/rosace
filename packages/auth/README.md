# @repo/auth

A custom auth layer to keep session, token, and identity logic aligned with Convex and SvelteKit.

## Why

Rosace runs a custom auth layer by design.

As of April 2026:

- [`get-convex/convex-svelte`](https://github.com/get-convex/convex-svelte): not maintained.
- [`get-convex/better-auth`](https://github.com/get-convex/better-auth): slow and ineffective.

This package gives that control by keeping auth-critical behavior in-house:

- session lifecycle in first-party cookies (`session:token`)
- short-lived Convex JWT issuance from server session state
- explicit credentials and OAuth flows in typed Convex functions
- explicit persistence model (`users`, `accounts`, `sessions`, `verifications`)

## Integration contract

1. Wire the server hook:

```ts
// src/hooks.server.ts
export { handle } from "$lib/auth";
```

Enables auth on every server request. Makes auth helpers available on `locals`.

1. Read authenticated user server-side:

```ts
// src/routes/+layout.server.ts
export const load = async ({ locals }) => {
  const session = await locals.auth();
  return { user: session?.user ?? null };
};
```

Loads current user on the server and exposes it as `data.user`.

1. Initialize Convex client auth only when user exists:

```svelte
<script lang="ts">
  import { useConvex } from "$lib/convex";
  let { data }: LayoutProps = $props();
  useConvex({ shouldFetch: () => !!data.user });
</script>
```

Only starts authenticated Convex fetches when `data.user` exists. Prevents unauthenticated calls during initial render.

## Endpoint contract

- `GET /.well-known/openid-configuration`:

  Returns OIDC discovery metadata for Convex. It includes `issuer`, `authorization_endpoint`, and `jwks_uri`.

- `GET /.well-known/jwks.json`:

  Returns public keys used to verify RS256-signed JWT access tokens. Convex uses these keys to validate JWT signature, `iss`, and `aud` claims.

- `GET /auth/session`:

  Returns current auth state.
  - Returns `null` when no valid session exists.
  - Returns `{ user, token, expires }` when a valid session exists.

- `POST /auth/logout`:

  Revokes the current refresh session when present. Clears `session:token`. Returns `204`.
  Rate limit: 100 requests / 60 seconds per IP.

- `POST /auth/login/credentials`:

  Handles email/password auth.
  - Register path hashes password, creates account, then creates session.
  - Login path verifies password, then creates session.
  - Rate limit: 3 requests / 10 seconds per IP.

- `GET /auth/login/apple`, `GET /auth/login/google`:

  Starts OAuth login. Creates state and nonce. Also creates PKCE values for Google. Stores values, then redirects to provider.
  Rate limit: 20 requests / 60 seconds per IP.

- `GET|POST /auth/callback/{provider}`:

  Completes OAuth login. Validates state, exchanges code, creates or links account, creates session, then issues handoff code.

- `GET /auth/session/claim`:

  Consumes handoff code, sets `session:token` cookie, then redirects to `/`.

## Key namespace

Dispatch keys:

- `store:query`:

  Runs read-only auth queries.

- `store:mutation`:

  Runs auth writes. This includes create, update, and delete operations.

- `store:action`:

  Runs auth side-effect and compute work. For example, password hash and verify operations.

Operation keys:

- `session:get`:

  Reads a session by refresh token hash. Returns the session user payload or `null`.

- `session:revoke`:

  Deletes a session by refresh token hash.

- `credentials:register`:

  Creates a credentials user and account with the provided password hash. Then creates a session.

- `credentials:login`:

  Handles two paths.
  - With `{ email }`, it returns the credentials account password hash lookup payload.
  - With `{ email, passwordHash }`, it validates the hash match and creates a session.

- `oauth:authorize`:

  Stores OAuth state, nonce, and verifier with expiry.

- `oauth:verify`:

  Consumes stored OAuth state one time and checks expiry.

- `oauth:finalize`:

  Resolves OAuth identity by linking or creating account and user records. Creates session and issues one-time handoff code.

- `oauth:claim`:

  Consumes the handoff code and returns the stored session payload one time.

- `password:hash`:

  Returns an Argon2 password hash from a plain password.

- `password:verify`:

  Verifies a plain password against a stored Argon2 hash and returns `{ ok }`.

## Required environment

- `CONVEX_SITE_URL`
- `DASHBOARD_URL`
- `AUTH_SECRET`
- `PUBLIC_JWKS`

OAuth provider credentials (if enabled):

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Apple: `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`

## Operational notes

- Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Rate limiting uses `cf-connecting-ip` first, then `x-forwarded-for`.
- Rate-limited responses return `429` with `X-Retry-After`.
- Credential/logout POST routes enforce `Origin === DASHBOARD_URL origin`.
- Authenticated `/auth/session` responses are `Cache-Control: no-store`.
