import { Apple } from "@repo/auth/providers";
import { Google } from "@repo/auth/providers";
import { convexAuth } from "@repo/auth/server";

export const { internalStore, registerRoutes } = convexAuth({
  socialProviders: [Apple, Google],
});
