import { env } from "$env/dynamic/public";
import { BetterAuthClientPlugin } from "better-auth/client";
import { createAuthClient } from "better-auth/svelte";
import { ConvexClient } from "convex/browser";
import { setContext } from "svelte";

import { convexClient } from "../plugin/client";

type AuthClient = ReturnType<
  typeof createAuthClient<BetterAuthClientPlugin & { plugins: [ReturnType<typeof convexClient>] }>
>;

interface SyncConvexOptions {
  authClient: AuthClient;
  hasToken: () => Promise<boolean>;
}

function syncConvex({ authClient, hasToken }: SyncConvexOptions) {
  const convex = new ConvexClient(env.PUBLIC_CONVEX_URL);
  setContext("$$_convex", convex);

  async function fetchToken() {
    const { data, error } = await authClient.convex.token();
    if (error) throw error;
    return data.token;
  }

  void hasToken().then((hasToken) => {
    if (hasToken) {
      convex.setAuth(fetchToken);
    }
  });

  authClient.$store.listen("$sessionSignal", () => {
    authClient.useSession().subscribe((s) => {
      convex.setAuth(s.data ? fetchToken : async () => null, () => {});
    });
  });
}

export { syncConvex };
