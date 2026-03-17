import { betterAuth } from "@repo/crpc/auth/config";
import type { AuthConfig } from "convex/server";
import { getEnv } from "./env";

export default {
	providers: [
		betterAuth({
			baseURL: getEnv().DASHBOARD_URL,
			jwks: getEnv().JWKS,
		}),
	],
} satisfies AuthConfig;
