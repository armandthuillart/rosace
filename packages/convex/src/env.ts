import * as v from "valibot";

const EnvSchema = v.object({
  APPLE_CLIENT_ID: v.string(),
  APPLE_CLIENT_SECRET: v.string(),
  AUTH_JWKS: v.string(),
  AUTH_SECRET: v.string(),
  CONVEX_URL: v.string(),
  CONVEX_SITE_URL: v.string(),
  DASHBOARD_URL: v.string(),
  DEPLOY_ENV: v.union([v.literal("development"), v.literal("production")]),
  GOOGLE_CLIENT_ID: v.string(),
  GOOGLE_CLIENT_SECRET: v.string(),
  MARKETING_URL: v.string(),
  RESEND_API_KEY: v.string(),
  STRIPE_SECRET_KEY: v.string(),
  STRIPE_WEBHOOK_SECRET: v.string(),
});

export const env = v.parse(EnvSchema, {
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
  APPLE_CLIENT_SECRET: process.env.APPLE_CLIENT_SECRET,
  AUTH_JWKS: process.env.AUTH_JWKS,
  AUTH_SECRET: process.env.AUTH_SECRET,
  CONVEX_URL: process.env.CONVEX_URL,
  CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
  DASHBOARD_URL: process.env.DASHBOARD_URL,
  DEPLOY_ENV: process.env.DEPLOY_ENV,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  MARKETING_URL: process.env.MARKETING_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
});
