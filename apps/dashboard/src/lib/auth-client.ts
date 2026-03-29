import type { Auth } from "@repo/convex";
import { convexClient } from "@repo/better-auth/client/plugins";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";
import { env } from "$lib/env";

export const authClient = createAuthClient({
  baseURL: env.PUBLIC_DASHBOARD_URL,
  plugins: [inferAdditionalFields<Auth>(), convexClient(), emailOTPClient()],
  sessionOptions: { refetchOnWindowFocus: false },
});
