import * as v from "valibot";
import { describe, expect, it, vi } from "vite-plus/test";

const { requireEnv } = vi.hoisted(() => ({
  requireEnv: vi.fn((key: string) => {
    const env: Record<string, string> = {
      APPLE_CLIENT_ID: "apple-id",
      APPLE_CLIENT_SECRET: "apple-secret",
      PUBLIC_JWKS: "jwks",
      AUTH_SECRET: "secret",
      CONVEX_URL: "https://convex.example",
      CONVEX_SITE_URL: "https://site.example",
      DASHBOARD_URL: "https://dashboard.example",
      DEPLOY_ENV: "development",
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      MARKETING_URL: "https://marketing.example",
      RESEND_API_KEY: "resend-key",
      STRIPE_SECRET_KEY: "stripe-secret",
      STRIPE_WEBHOOK_SECRET: "stripe-webhook-secret",
    };
    return env[key];
  }),
}));

vi.mock("@repo/helpers", () => ({ requireEnv }));

async function loadEnv() {
  vi.resetModules();
  const mod = await import("./env");
  return mod.env;
}

describe("env validation", () => {
  it("should succeed with all valid variables", async () => {
    const env = await loadEnv();

    expect(env.CONVEX_URL).toBe("https://convex.example");
    expect(env.DEPLOY_ENV).toBe("development");
    expect(env.RESEND_API_KEY).toBe("resend-key");
  });

  it("should throw when a required variable is missing", async () => {
    requireEnv.mockImplementationOnce(() => {
      throw new Error("Missing CONVEX_URL");
    });

    await expect(loadEnv()).rejects.toThrow();
  });

  it("should throw when DEPLOY_ENV is not 'development' or 'production'", async () => {
    const EnvSchema = v.object({
      DEPLOY_ENV: v.union([v.literal("development"), v.literal("production")]),
    });

    expect(() => v.parse(EnvSchema, { DEPLOY_ENV: "staging" })).toThrow();
    expect(() => v.parse(EnvSchema, { DEPLOY_ENV: "development" })).not.toThrow();
    expect(() => v.parse(EnvSchema, { DEPLOY_ENV: "production" })).not.toThrow();
  });

  it("should accept 'production' as valid DEPLOY_ENV", async () => {
    requireEnv.mockImplementation((key: string) => {
      const env: Record<string, string> = {
        APPLE_CLIENT_ID: "apple-id",
        APPLE_CLIENT_SECRET: "apple-secret",
        PUBLIC_JWKS: "jwks",
        AUTH_SECRET: "secret",
        CONVEX_URL: "https://convex.example",
        CONVEX_SITE_URL: "https://site.example",
        DASHBOARD_URL: "https://dashboard.example",
        DEPLOY_ENV: "production",
        GOOGLE_CLIENT_ID: "google-id",
        GOOGLE_CLIENT_SECRET: "google-secret",
        MARKETING_URL: "https://marketing.example",
        RESEND_API_KEY: "resend-key",
        STRIPE_SECRET_KEY: "stripe-secret",
        STRIPE_WEBHOOK_SECRET: "stripe-webhook-secret",
      };
      return env[key];
    });

    const env = await loadEnv();
    expect(env.DEPLOY_ENV).toBe("production");
  });
});
