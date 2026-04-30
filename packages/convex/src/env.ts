import { requireEnv } from "@repo/helpers";
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
  APPLE_CLIENT_ID: requireEnv("APPLE_CLIENT_ID"),
  APPLE_CLIENT_SECRET: requireEnv("APPLE_CLIENT_SECRET"),
  AUTH_JWKS: requireEnv("AUTH_JWKS"),
  AUTH_SECRET: requireEnv("AUTH_SECRET"),
  CONVEX_URL: requireEnv("CONVEX_URL"),
  CONVEX_SITE_URL: requireEnv("CONVEX_SITE_URL"),
  DASHBOARD_URL: requireEnv("DASHBOARD_URL"),
  DEPLOY_ENV: requireEnv("DEPLOY_ENV"),
  GOOGLE_CLIENT_ID: requireEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: requireEnv("GOOGLE_CLIENT_SECRET"),
  MARKETING_URL: requireEnv("MARKETING_URL"),
  RESEND_API_KEY: requireEnv("RESEND_API_KEY"),
  STRIPE_SECRET_KEY: requireEnv("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: requireEnv("STRIPE_WEBHOOK_SECRET"),
});
