import { AuthConfig } from "convex/server";

import { getEnv } from "./env";

export default {
  providers: [
    {
      domain: getEnv().DASHBOARD_URL,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
