import { env } from "$env/dynamic/public";
import { convexClient } from "@repo/better-auth/client/plugin";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient({
  baseURL: env.PUBLIC_DASHBOARD_URL,
  plugins: [convexClient(), emailOTPClient()],
});

export type AuthClient = typeof authClient;

export const { signIn } = authClient;
