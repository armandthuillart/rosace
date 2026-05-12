# @repo/svelte

SvelteKit integration for Rosace's Convex auth backend.

## Why

Rosace runs a custom auth layer by design.

As of April 2026:

- [`get-convex/convex-svelte`](https://github.com/get-convex/convex-svelte): not maintained.

This package gives that control by keeping the SvelteKit bindings in-house:

- PostHog analytics wired into the auth flow
- session lifecycle in first-party cookies (`session:token`)
- short-lived Convex JWT issuance from server session state
- explicit OAuth flows in typed Convex functions
- explicit persistence model (`users`, `accounts`, `sessions`, `verifications`)

## Integration contract

1. Wire the server hook:

```ts
// src/hooks.server.ts
export { handle } from '$lib/auth';
```

Enables auth on every server request. Proxies `/auth/*` routes to the Convex backend. Makes `locals.auth()` available.

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
