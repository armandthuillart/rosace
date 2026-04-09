import { env } from "$lib/env";
import { betterAuth } from "@repo/better-auth/svelte";

export const { GET, POST } = betterAuth({
  baseURL: env.PUBLIC_DASHBOARD_URL,
});
