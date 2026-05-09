import { convexAuth } from "@repo/auth/convex";

const { authStore, registerRoutes } = convexAuth();

export const { query, mutation } = authStore;

export { registerRoutes };
