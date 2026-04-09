import { env } from "$lib/env";
import { convexClient } from "@repo/better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient as createClient } from "better-auth/svelte";

export const authClient = createClient({
  baseURL: env.PUBLIC_DASHBOARD_URL,
  plugins: [convexClient(), emailOTPClient()],
  sessionOptions: { refetchOnWindowFocus: false },
});
