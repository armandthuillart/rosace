import { getJWKS } from "@repo/better-auth/svelte";
import { setJWKS } from "@repo/crpc/svelte";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const jwks = getJWKS(event.cookies);
  event.locals.jwks = jwks;
  return setJWKS(jwks, () => resolve(event));
};
