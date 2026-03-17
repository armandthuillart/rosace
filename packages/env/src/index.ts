import { config as loadEnv } from "dotenv";
import { z } from "zod";

const envSchema = z.object({
	CONVEX_SITE_URL: z.string(),
	CONVEX_URL: z.string(),
	DASHBOARD_URL: z.string(),
	MARKETING_URL: z.string(),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

function getEnv(): Env {
	if (cachedEnv) {
		return cachedEnv;
	}

	loadEnv({
		path: ".env.development",
		quiet: true,
	});

	cachedEnv = envSchema.parse({
		CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
		CONVEX_URL: process.env.CONVEX_URL,
		DASHBOARD_URL: process.env.DASHBOARD_URL,
		MARKETING_URL: process.env.MARKETING_URL,
	});

	return cachedEnv;
}

export { type Env, getEnv };
