import { convexAuth } from "@repo/auth/convex";

const { internalStore, registerRoutes } = convexAuth();

export const storeQuery = internalStore.query;
export const storeMutation = internalStore.mutation;

export { registerRoutes };
