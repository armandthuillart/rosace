import { getAuth } from "@repo/better-auth/svelte";
import { api } from "@repo/convex/api";
import { convexQuery } from "@repo/crpc/svelte";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const auth = getAuth();

  if (!locals.token || url.pathname.includes("/register")) {
    return { auth };
  }

  const user = await convexQuery(api.user.getUser, {
    token: locals.token,
  });

  return { auth, user };
};
