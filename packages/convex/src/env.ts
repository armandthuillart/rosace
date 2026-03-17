import { createEnv } from "@repo/crpc/server";
import { z } from "zod";

const envSchema = z.object({
	APPLE_CLIENT_ID: z.string(),
	APPLE_CLIENT_SECRET: z.string(),
	DASHBOARD_URL: z.string(),
	DEPLOY_ENV: z.enum(["development", "production"]),
	GOOGLE_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),
	JWKS: z.string(),
	MARKETING_URL: z.string(),
	RESEND_API_KEY: z.string(),
	STRIPE_SECRET_KEY: z.string(),
	STRIPE_WEBHOOK_SECRET: z.string(),
});

export const getEnv = createEnv({
	envSchema,
});
