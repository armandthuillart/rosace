import { env } from "$env/dynamic/public";
import { betterAuth } from "@repo/better-auth/svelte";

export const { GET, POST } = betterAuth({
  siteURL: env.PUBLIC_CONVEX_SITE_URL ?? "",
});
