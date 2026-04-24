import { PUBLIC_CONVEX_SITE_URL } from "$env/static/public";
import { svelteAuth } from "@repo/auth/sveltekit";

export const { handle, login, logout } = svelteAuth({
  convexSiteUrl: PUBLIC_CONVEX_SITE_URL,
});
