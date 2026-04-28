import { convexAuth } from "@repo/auth/convex";

const { authStore, registerRoutes } = convexAuth();

export const { query, action, mutation } = authStore;

export { registerRoutes };
