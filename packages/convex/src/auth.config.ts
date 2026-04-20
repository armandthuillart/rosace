import { AuthConfig } from "convex/server";

import { getEnv } from "./env";

const env = getEnv();

export default {
  providers: [
    {
      domain: env.DASHBOARD_URL,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
