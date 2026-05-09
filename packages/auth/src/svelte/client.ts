// @ts-ignore
import { env } from "$env/dynamic/public";
// @ts-ignore
import { browser } from "$app/environment";
import { ConvexHttpClient } from "convex/browser";
import posthog from "posthog-js";

import { Auth } from "./index.types";

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
        if (!browser) {
          return;
        }

        if (!shouldFetch()) {
          convex.clearAuth();
          return;
        }

        const res = await globalThis.fetch("/auth/session", {
          credentials: "include",
        });

        if (!res.ok) {
          convex.clearAuth();
          return;
        }

        const session = (await res.json()) as Auth;

        if (session && session.token) {
          convex.setAuth(session.token);
          const { _id, _creationTime, ...profile } = session.user;
          posthog.identify(_id, {
            ...profile,
            name: `${profile.firstName} ${profile.lastName}`,
          });
        } else {
          convex.clearAuth();
        }
      })();

      return convex;
    },
    useQuery: {},
  };
}
