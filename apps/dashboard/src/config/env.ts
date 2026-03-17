import { z } from "zod";

const envSchema = z.object({
	VITE_CONVEX_SITE_URL: z.string(),
	VITE_CONVEX_URL: z.string(),
	VITE_DASHBOARD_URL: z.string(),
	VITE_MARKETING_URL: z.string(),
});

export const env = envSchema.parse(import.meta.env);
