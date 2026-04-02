import {
  PUBLIC_CONVEX_SITE_URL,
  PUBLIC_CONVEX_URL,
  PUBLIC_DASHBOARD_URL,
  PUBLIC_MARKETING_URL,
} from "$env/static/public";
import { z } from "zod";

const envSchema = z.object({
  PUBLIC_CONVEX_SITE_URL: z.url(),
  PUBLIC_CONVEX_URL: z.url(),
  PUBLIC_DASHBOARD_URL: z.url(),
  PUBLIC_MARKETING_URL: z.url(),
});

export const env = envSchema.parse({
  PUBLIC_CONVEX_SITE_URL,
  PUBLIC_CONVEX_URL,
  PUBLIC_DASHBOARD_URL,
  PUBLIC_MARKETING_URL,
});
