import { PUBLIC_CONVEX_URL } from "$env/static/public";
import { getAuth } from "@repo/better-auth/svelte";
import { api } from "@repo/convex/api";
import { convexClient } from "@repo/crpc/svelte";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const auth = getAuth();
  const jwks = locals.jwks;

  if (!jwks) {
    return { auth, data: undefined };
  }

  const convex = convexClient({
    baseURL: PUBLIC_CONVEX_URL,
    jwks,
  });

  const user = await convex.query(api.user.getUser);

  return { auth, user };
};
