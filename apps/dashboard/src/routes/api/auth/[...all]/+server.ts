import { env } from "$env/dynamic/public";
import { handler } from "@repo/better-auth/svelte";

export const { GET, POST } = handler({
  siteURL: env.PUBLIC_CONVEX_SITE_URL ?? "",
});
