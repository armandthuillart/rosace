# @repo/auth

Custom auth for SvelteKit + Convex, implemented with:

- A long-lived refresh session cookie (`session:refresh`)
- A short-lived Convex access JWT (`token`)
- Credential and OAuth login routes exposed under `/auth/*`

This README is intentionally educational. It explains what the auth layer does, why it is implemented this way, and where the most common integration mistakes happen.

## Mental model first

Before looking at endpoints, lock in this model:

1. `session:refresh` (HttpOnly cookie) proves the browser has a server session.
2. `/auth/session` exchanges that cookie for a user payload plus a Convex auth JWT.
3. The app gives the JWT to Convex client code (`convex.setAuth(token)`).

Why this split is useful:

- The refresh token stays in a cookie that JS cannot read (good for XSS hardening).
- The Convex JWT can stay short-lived and in-memory only (no localStorage persistence).
- If a JWT leaks, its lifetime is low (`15m`); if a cookie leaks, it is still tied to server-side lookup + secret-based hashing.

## Quick start

```bash
vp add @repo/auth
```

```typescript
// src/hooks.server.ts
import { handle } from "$lib/auth";

export { handle };
```

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = await locals.auth();
  return { user: session?.user ?? null };
};
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { useConvex } from "$lib/convex";

  let { children, data }: LayoutProps = $props();

  // Only initialize authenticated Convex fetching when the server says a user exists.
  useConvex({ shouldFetch: () => !!data.user });
</script>

{@render children()}
```

> [!TIP]
> The package wires `/auth/*` route handling through the server hook flow. You should not manually build duplicate auth endpoints in SvelteKit for these paths.

## Auth architecture at a glance

```text
Browser
  |- Cookie: session:refresh (HttpOnly, Secure, SameSite=Lax)
  |- In-memory: Convex JWT token from /auth/session
  v
Auth HTTP routes (/auth/*)
  |- read cookie
  |- hash token with AUTH_SECRET
  |- lookup session in Convex
  |- mint short-lived JWT for Convex audience
  v
Convex tables
  |- users
  |- accounts
  |- sessions
  |- verifications (oauth state + oauth handoff codes)
```

## Core concepts

### 1) Refresh session cookie (`session:refresh`)

The cookie stores a random token (32 random bytes rendered as 64 hex chars).  
The raw token is never saved in Convex.

What gets persisted:

- `refreshTokenHash = SHA-256(token + ":" + AUTH_SECRET)`
- `userId`
- `expiresAt` (30 days from session creation)

Why this matters:

- Database compromise alone does not expose reusable refresh tokens.
- Attackers would need both stored hash material and server secret logic to replay tokens.

### 2) Convex access token (`token`)

For authenticated session reads, the server signs a JWT (`RS256`) with:

- `sub = userId`
- `aud = "convex"`
- `iss = CONVEX_SITE_URL`
- `exp = 15m`

The JWT is returned to the client in `/auth/session` responses and should be used to call `convex.setAuth(token)`.

Important nuance:

- The response field `expires` currently reflects the session expiry timestamp (the cookie/session horizon), not the 15-minute JWT expiration timestamp.
- The JWT itself still expires after 15 minutes and is re-issued by subsequent authenticated session reads.

### 3) CSRF defense for credential/logout POST endpoints

`POST /auth/login/credentials` and `POST /auth/logout` enforce origin checks:

- Incoming `Origin` header must match `new URL(DASHBOARD_URL).origin`.
- Missing or mismatched origin -> `403`.

This protects state-changing cookie-backed routes from cross-site form abuse.

## Flows

### Credential flow (`POST /auth/login/credentials`)

Request body:

```typescript
{
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}
```

Validation behavior:

- `email` must be valid and is normalized to lowercase.
- `password` minimum length is 8.
- If both `firstName` and `lastName` are present, the flow is treated as **register**.
- Otherwise, it is treated as **login**.

Register mode (`flow = "register"`):

1. Reject if a user already exists with same email.
2. Insert `users` row (`plan: "free"`, `verified: false`).
3. Insert credential account with `passwordHash`.
4. Create session and set `session:refresh` cookie.

Login mode (`flow = "login"`):

1. Find user by email.
2. Find credentials account for that user.
3. Verify password (`PBKDF2-SHA256`, stored format includes iterations + salt).
4. Create session and set cookie.

Response:

- `200` with `{"ok": true}` on success + `Set-Cookie`
- `400` on invalid payload
- `401` on invalid credentials/business errors
- `403` on CSRF origin failure

Educational note:

- Register-vs-login based on presence of names keeps one endpoint simple, but frontend UX should be explicit so users do not accidentally hit the wrong mode.

### Session read flow (`GET /auth/session`)

Behavior:

1. Read `session:refresh` cookie.
2. If absent -> return JSON `null` (`200`).
3. Hash token, lookup session by `refreshTokenHash`.
4. Validate session not expired.
5. Load user.
6. Return `{ user, token, expires }` where `token` is a fresh Convex JWT.
7. If token is invalid/stale -> return JSON `null` and clear cookie.

Response shape:

```typescript
type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: "free" | "pro";
  verified: boolean;
};

type SessionResponse = null | {
  user: SessionUser;
  token: string; // Convex bearer token (JWT)
  expires: number; // Session expiration epoch ms
};
```

Caching:

- Authenticated responses include `Cache-Control: no-store`.
- Treat this endpoint as private and non-cacheable in clients/proxies.

### Logout flow (`POST /auth/logout`)

Behavior:

1. Run CSRF origin check.
2. Read refresh cookie token if present.
3. Best-effort delete session row from `sessions`.
4. Clear refresh cookie with `Max-Age=0`.
5. Return `204` (no body).

Important correction:

- Logout does **not** redirect by itself. Your app can decide where to navigate after receiving `204`.

### OAuth start flow (`GET /auth/login/{provider}`)

Supported providers:

- `google`
- `apple`

Behavior:

1. Validate provider path segment.
2. Build provider authorize URL.
3. Generate `state` and `nonce` (random UUID-derived values).
4. Generate PKCE verifier/challenge pair.
5. Store oauth state record in `verifications` with 15-minute TTL.
6. For Google only: attach PKCE challenge (`S256`) to authorize URL.
7. Redirect (`302`) to provider.

Why state + PKCE:

- `state` defends against CSRF/session confusion in callback handling.
- PKCE reduces authorization code interception risk.

### OAuth callback flow (`GET/POST /auth/callback/{provider}`)

Both methods are accepted to support provider callback styles:

- Google typically uses query params on GET.
- Apple may post form-encoded payload (`response_mode=form_post`).

Behavior:

1. Validate provider.
2. Extract `code` + `state` (query or posted form fields).
3. Consume stored oauth state from `verifications` (`oauth:consume`).
4. Exchange provider code for identity claims (`exchangeCode`).
5. Upsert/find account and user (`oauth:complete`).
6. Create session payload.
7. Issue one-time handoff code (`oauth:handoff:issue`, 60s TTL).
8. Redirect to:
   - `${DASHBOARD_URL}/auth/session/claim?code=<handoff>`

Educational note:

- The handoff code exists so callback completion can move auth material in a short-lived, one-time form instead of dropping long-lived token values directly into a URL.

### OAuth session claim flow (`GET /auth/session/claim`)

This endpoint consumes the one-time handoff code and finalizes browser auth state:

1. Read `code` from query.
2. Claim and delete handoff entry.
3. Set `session:refresh` cookie.
4. Redirect to `/`.

If the code is invalid/expired:

- Returns `400` with an error message.

Integration expectation:

- Because OAuth callback redirects the browser to `${DASHBOARD_URL}/auth/session/claim?...`, ensure that route resolves to this auth handler in your deployment topology.

## Endpoint reference

### `GET /.well-known/openid-configuration`

Returns OIDC metadata:

- `issuer`
- `authorization_endpoint`
- `jwks_uri`

### `GET /.well-known/jwks.json`

Returns public JWK set derived from `AUTH_JWKS`.

### `GET /auth/session`

Returns current auth state:

- `200` + `null` when unauthenticated
- `200` + `{ user, token, expires }` when authenticated

### `POST /auth/logout`

Invalidates cookie-backed session:

- `204` on success (always clears cookie)
- `403` when origin check fails

### `POST /auth/login/credentials`

Credentials auth:

- `200` on success
- `400` bad payload
- `401` invalid credentials/register conflict
- `403` origin check failed

### `GET /auth/login/apple`

### `GET /auth/login/google`

Start OAuth and redirect to provider.

### `GET /auth/callback/{provider}`

### `POST /auth/callback/{provider}`

Complete provider callback, then redirect to handoff claim route.

### `GET /auth/session/claim`

Consume one-time OAuth handoff code and set cookie.

## Data model summary

### `users`

- identity and profile (`email`, `firstName`, `lastName`)
- product fields (`plan`, `verified`)

### `accounts`

- login methods linked to a user (`provider`, `subject`, optional `passwordHash`)

### `sessions`

- refresh-session state (`refreshTokenHash`, `userId`, `expiresAt`)

### `verifications`

- temporary records for:
  - OAuth state/verifier transport (`oauth_state`)
  - OAuth handoff code (`oauth_handoff`)

## Security properties

- Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`.
- Session token at rest is hashed with `AUTH_SECRET` before lookup.
- Passwords use `PBKDF2-SHA256` with per-password random salt and stored iteration count.
- Convex JWT is short-lived (`15m`) and intended for in-memory use only.
- State-changing POST routes enforce dashboard origin checks.
- Session endpoint uses `no-store` on authenticated responses to reduce caching risk.

## Environment variables

### Always required

| Variable          | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `CONVEX_SITE_URL` | Base URL for issuer metadata and callback URI construction |
| `DASHBOARD_URL`   | Trusted browser app origin and OAuth redirect target       |
| `AUTH_SECRET`     | Secret mixed into refresh token hashing                    |
| `AUTH_JWKS`       | JSON containing signing key material and public JWKS       |

### Required when provider is enabled

| Provider | Variables                                  |
| -------- | ------------------------------------------ |
| Google   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Apple    | `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`   |

## `AUTH_JWKS` shape

`AUTH_JWKS` must parse as JSON with this shape:

```typescript
type AuthJwks = {
  kid: string;
  privateJwk: JsonWebKey;
  publicJwks: {
    keys: JsonWebKey[];
  };
};
```

The private JWK is used for signing (`RS256`), and `publicJwks` is served at `/.well-known/jwks.json`.

## SvelteKit integration pattern

### Load user server-side

```typescript
// +layout.server.ts
export const load = async ({ locals }) => {
  const session = await locals.auth();
  return { user: session?.user ?? null };
};
```

### Bootstrap Convex auth client-side

```typescript
// pseudo-example
const session = await fetch("/auth/session", { credentials: "include" }).then((r) => r.json());
if (session?.token) convex.setAuth(session.token);
```

Why this pattern works:

- Server load gives initial UI auth state safely.
- Client then receives a Convex-compatible bearer token.

## Troubleshooting

### `403` on login/logout

Likely cause:

- `Origin` does not match `DASHBOARD_URL` origin, or `Origin` header missing.

Fix:

- Ensure requests originate from the configured dashboard origin.
- Confirm reverse proxy headers preserve `Origin`.

### OAuth callback says invalid or expired state

Likely causes:

- User took too long (state TTL is 15 minutes).
- Callback hit wrong environment or provider path.
- State already consumed (single-use by design).

Fix:

- Restart OAuth flow from `/auth/login/{provider}`.
- Verify production/staging URLs and provider credentials align.

### OAuth callback says provider did not return an email

Likely causes:

- Provider scope/consent did not return email.
- Apple account/privacy settings can limit fields.

Fix:

- Ensure scopes include email (`openid email profile` for Google, `name email` for Apple).
- Re-consent and confirm provider app configuration.

### Session keeps returning `null`

Likely causes:

- Missing/blocked `session:refresh` cookie.
- Cookie expired or session row missing.
- `AUTH_SECRET` changed between issuance and lookup.

Fix:

- Check cookie flags and HTTPS behavior.
- Verify session persistence in `sessions`.
- Avoid rotating `AUTH_SECRET` without a migration/invalidation plan.

### Convex requests fail after login

Likely causes:

- Client never called `convex.setAuth(token)`.
- Token fetched once and never refreshed after expiry.

Fix:

- Fetch `/auth/session` and set token before protected Convex calls.
- Re-fetch session periodically or on auth failures.

## Operational notes

- Session lifetime is currently 30 days (`SESSION_DURATION_MS`).
- Expired `verifications` rows are cleaned opportunistically during verification lookups.
- Logout session deletion is best-effort; cookie is always cleared in response.

## Reference types

```typescript
type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: "free" | "pro";
  verified: boolean;
};

type AuthSession = null | {
  user: AuthUser;
  token: string;
  expires: number;
};
```
