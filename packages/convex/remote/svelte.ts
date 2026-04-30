// @ts-ignore
import { env } from "$env/dynamic/public";
import { ConvexHttpClient } from "convex/browser";

type Session = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: "free" | "pro";
    verified: boolean;
  };
  token: string;
  expires: number;
} | null;

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

        const session = (await res.json()) as Session;

        if (session && session.token) {
          convex.setAuth(session.token);
        } else {
          convex.clearAuth();
        }
      })();

      return convex;
    },
    useQuery: {},
  };
}
