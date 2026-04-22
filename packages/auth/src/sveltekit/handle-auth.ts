import { ConvexClient } from "convex/browser";
import { setContext } from "svelte";

import { requireEnv } from "../utils";

function handleAuth({ fetch }: { fetch: () => Promise<boolean> }) {
  const convex = new ConvexClient(requireEnv("CONVEX_URL"));
  setContext("$$_convex", convex);

  async function fetchToken() {
    const res = await globalThis.fetch("/auth/token", {
      credentials: "include",
      method: "GET",
    });

    if (!res.ok) {
      return null;
    }

    const { token } = (await res.json()) as {
      token: string | null;
    };

    return token;
  }

  fetch().then((ok) => {
    if (ok) convex.setAuth(fetchToken);
  });
}

export { handleAuth };
