import { env } from "$env/dynamic/public";
import { setupServer } from "@repo/better-auth/svelte";

export const { convexQuery, handler } = setupServer({
  address: env.PUBLIC_CONVEX_SITE_URL!,
});
