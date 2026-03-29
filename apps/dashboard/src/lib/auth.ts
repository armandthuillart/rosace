import { convexClient } from "@repo/better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";
import { env } from "$lib/env";

export const client = createAuthClient({
  baseURL: env.PUBLIC_DASHBOARD_URL,
  plugins: [convexClient(), emailOTPClient()],
  sessionOptions: { refetchOnWindowFocus: false },
});
