import * as v from "valibot";

import { createEnv } from "../../crpc/src";

const envSchema = v.object({
  APPLE_CLIENT_ID: v.string(),
  APPLE_CLIENT_SECRET: v.string(),
  AUTH_JWKS: v.string(),
  AUTH_SECRET: v.string(),
  DASHBOARD_URL: v.string(),
  DEPLOY_ENV: v.union([v.literal("development"), v.literal("production")]),
  GOOGLE_CLIENT_ID: v.string(),
  GOOGLE_CLIENT_SECRET: v.string(),
  MARKETING_URL: v.string(),
  RESEND_API_KEY: v.string(),
  STRIPE_SECRET_KEY: v.string(),
  STRIPE_WEBHOOK_SECRET: v.string(),
});

export const getEnv = createEnv({
  envSchema,
});
