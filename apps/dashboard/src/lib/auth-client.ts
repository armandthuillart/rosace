import { convexClient } from "@repo/better-auth/client/plugin";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient({
  plugins: [convexClient(), emailOTPClient()],
});

export const { signIn } = authClient;
