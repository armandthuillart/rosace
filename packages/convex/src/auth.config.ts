import { betterAuth } from "@repo/crpc/auth/provider";
import type { AuthConfig } from "convex/server";

import { getEnv } from "./env";

const env = getEnv();

export default {
  providers: [
    betterAuth({
      baseURL: env.DASHBOARD_URL,
      jwks: env.JWKS,
    }),
  ],
} satisfies AuthConfig;
