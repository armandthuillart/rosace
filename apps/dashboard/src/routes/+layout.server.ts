import { env } from "$env/dynamic/public";
import { getAuth } from "@repo/better-auth/svelte";
import { api } from "@repo/convex/api";
import { convexClient } from "@repo/crpc/svelte";

import type { LayoutServerLoad } from "./$types";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const auth = getAuth();

  if (PUBLIC_PATHS.has(url.pathname)) {
    return { auth };
  }

  if (!locals.jwks) {
    return { auth };
  }

  const convex = convexClient({
    convexURL: env.PUBLIC_CONVEX_URL ?? "",
    jwks: locals.jwks,
  });

  const user = await convex.query(api.user.getUser);

  return { auth, user };
};
