import type { Auth } from "@repo/convex";
import { convexClient } from "@repo/better-auth/plugins/convex-client";
import {
	emailOTPClient,
	inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "@/config/env";

export const authClient = createAuthClient({
	baseURL: env.VITE_DASHBOARD_URL,
	plugins: [inferAdditionalFields<Auth>(), convexClient(), emailOTPClient()],
	sessionOptions: { refetchOnWindowFocus: false },
});
