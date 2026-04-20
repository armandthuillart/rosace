import { ConvexClient } from "convex/browser";
import { setContext } from "svelte";

import { requireEnv } from "../utils";

function handleAuth({ fetch }: { fetch: () => Promise<boolean> }) {
  const convex = new ConvexClient(requireEnv("CONVEX_URL"));
  setContext("$$_convex", convex);

  // if fetch is true, we directly call the convex function?

  // if fetch is false, we read the storage
}

export { handleAuth };
