import { Apple, Google } from "@repo/auth/providers";
import { convexAuth } from "@repo/auth/server";

const { internalStore, registerRoutes } = convexAuth({
  socialProviders: [Apple, Google],
});

export const storeQuery = internalStore.query;
export const storeMutation = internalStore.mutation;

export { registerRoutes };
