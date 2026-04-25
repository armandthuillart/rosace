import { AuthConfig } from "convex/server";

import { env } from "./env";

export default {
  providers: [
    {
      domain: env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
