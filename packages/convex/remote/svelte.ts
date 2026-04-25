// @ts-ignore
import { env } from "$env/dynamic/public";
import { ConvexHttpClient } from "convex/browser";

type Result = {
  accessToken?: string;
};

const CONVEX_URL = env.PUBLIC_CONVEX_URL!;

if (!CONVEX_URL) {
  throw new Error("CONVEX_URL is not set");
}

let client: ConvexHttpClient | undefined;

function getClient() {
  if (!client) {
    client = new ConvexHttpClient(CONVEX_URL);
  }
  return client;
}

export function convexClient() {
  return {
    useConvex: ({ shouldFetch }: { shouldFetch: () => boolean }) => {
      const convex = getClient();

      void (async () => {
        if (!shouldFetch()) {
          convex.clearAuth();
          return;
        }

        const res = await globalThis.fetch(`${CONVEX_URL}/auth/session`, {
          credentials: "include",
        });

        if (!res.ok) {
          convex.clearAuth();
          return;
        }

        const data = (await res.json()) as Result;

        if (data.accessToken) {
          convex.setAuth(data.accessToken);
        } else {
          convex.clearAuth();
        }
      });

      return convex;
    },
    useQuery: {},
  };
}
