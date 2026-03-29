import { convex } from "@repo/crpc/auth/plugins";
import { emailOTP } from "better-auth/plugins";
import { internal } from "./_generated/api";
import betterAuth from "./auth.config";
import { defineAuth } from "./crpc/auth";
import { getEnv } from "./env";

export default defineAuth((ctx) => {
  const env = getEnv();

  return {
    account: {
      accountLinking: {
        allowDifferentEmails: true,
        enabled: true,
        trustedProviders: ["apple", "email-password", "google"],
        updateUserInfoOnLink: true,
      },
    },
    baseURL: env.DASHBOARD_URL,
    emailAndPassword: {
      enabled: true,
    },
    emailVerification: {
      autoSignInAfterVerification: true,
    },
    plugins: [
      convex({
        baseURL: env.DASHBOARD_URL,
        jwks: env.JWKS,
        provider: [betterAuth],
      }),
      emailOTP({
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp, type }) {
          if (type === "forget-password") {
            await ctx.scheduler.runAfter(0, internal.email.resetPassword, {
              otp,
              to: email,
            });
            return;
          }

          if (type === "change-email") {
            await ctx.scheduler.runAfter(0, internal.email.changeEmail, {
              otp,
              to: email,
            });
            return;
          }

          if (type === "sign-in") {
            await ctx.scheduler.runAfter(0, internal.email.sendOtp, {
              otp,
              to: email,
            });
          }
        },
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24 * 15, // 15 days
    },
    socialProviders: {
      apple: {
        clientId: env.APPLE_CLIENT_ID,
        clientSecret: env.APPLE_CLIENT_SECRET,
      },
      google: {
        accessType: "offline",
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: "select_account consent",
      },
    },
    telemetry: {
      enabled: false,
    },
    trustedOrigins: [env.DASHBOARD_URL, "https://appleid.apple.com"],
    user: {
      changeEmail: {
        enabled: true,
      },
      deleteUser: {
        enabled: true,
      },
    },
  };
});
