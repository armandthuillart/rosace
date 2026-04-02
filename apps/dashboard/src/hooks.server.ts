import { getJWKS } from "@repo/better-auth/svelte";
import { createAuth } from "@repo/convex/auth";
import { setJWKS } from "@repo/convex/svelte";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const jwks = await getJWKS(createAuth, event.cookies);
  event.locals.jwks = jwks;
  return setJWKS(jwks, () => resolve(event));
};
