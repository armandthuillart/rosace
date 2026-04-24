import type { HttpRouter } from "convex/server";

import type { ConvexAuthConfig, SocialProvider } from "../types";
import { internalStore } from "./internal-store";
import { registerRoutes as register } from "./register-routes";

function convexAuth(config: ConvexAuthConfig = {}) {
  const providers: SocialProvider[] =
    config.socialProviders?.map((provider) => provider.name) ?? [];

  return {
    internalStore,
    registerRoutes: (http: HttpRouter) => register(http, providers),
  };
}

export { convexAuth };
