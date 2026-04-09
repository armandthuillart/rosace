import type { BetterAuthClientPlugin } from "better-auth/client";

import type { convex } from "./index";

export const convexClient = () =>
  ({
    $InferServerPlugin: {} as ReturnType<typeof convex>,
    id: "convex",
  }) satisfies BetterAuthClientPlugin;
