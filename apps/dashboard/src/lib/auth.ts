import { env } from "$env/dynamic/public";
import { convexClient } from "@repo/better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";

export const auth = createAuthClient({
  baseURL: env.PUBLIC_DASHBOARD_URL,
  plugins: [convexClient(), emailOTPClient()],
  sessionOptions: { refetchOnWindowFocus: false },
});
