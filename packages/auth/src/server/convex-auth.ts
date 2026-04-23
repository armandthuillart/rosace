import { internalStore } from "./internal-store";
import { registerRoutes } from "./register-routes";

function convexAuth() {
  return { internalStore, registerRoutes };
}

export { convexAuth };
