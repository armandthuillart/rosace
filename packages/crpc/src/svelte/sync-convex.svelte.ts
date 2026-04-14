import { env } from "$env/dynamic/public";
import { ConvexClient } from "convex/browser";
import { setContext } from "svelte";

type FetchAccessToken = (args: { forceRefreshToken: boolean }) => Promise<string | null>;
const CONVEX_CONTEXT_KEY = "$$_convexClient";

type SessionState = {
  data: Record<string, unknown> | null;
  isPending: boolean;
  isRefetching?: boolean;
};

type SessionStore = {
  subscribe(listener: (state: SessionState) => void): () => void;
};

type AuthClient = {
  useSession: () => SessionStore;
  $store: {
    listen: (key: string, listener: () => void) => void;
  };
  convex?: {
    token: () => Promise<{ data?: { token?: string | null } }>;
  };
};

type InitialAuthState = {
  isAuthenticated: boolean;
};

type SyncConvexArgs = {
  client: AuthClient;
  server: InitialAuthState | undefined | (() => InitialAuthState | undefined);
};

const isLikelyNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("ecconn")
  );
};

const fetchTokenWithRetry = async (client: AuthClient): Promise<string | null> => {
  const convex = client.convex;
  if (!convex?.token) return null;
  const initialBackoffMs = 100;
  const maxBackoffMs = 1000;
  let retries = 0;

  const nextBackoff = () => {
    const base = Math.min(initialBackoffMs * 2 ** retries, maxBackoffMs);
    retries += 1;
    const jitter = base * (Math.random() - 0.5);
    return base + jitter;
  };

  const run = async (): Promise<string | null> => {
    try {
      const { data } = await convex.token();
      return data?.token ?? null;
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        // Session likely expired/invalid: treat as unauthenticated.
        return null;
      }
      if (retries > 10) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, nextBackoff()));
      return run();
    }
  };

  return run();
};

function syncConvex({ client, server }: SyncConvexArgs): void {
  const convexURL = env.PUBLIC_CONVEX_URL;
  if (!convexURL) return;
  const convexClient = new ConvexClient(convexURL, { disabled: false });
  setContext(CONVEX_CONTEXT_KEY, convexClient);

  let sessionData: SessionState["data"] = $state(null);
  let sessionPending = $state(true);

  let authOperationPending = false;
  let signalInitialized = false;
  let authOpSettledResolve: (() => void) | null = null;
  let authOpSettledPromise: Promise<void> | null = null;
  let sessionHasBeenAvailable = false;

  client.$store.listen("$sessionSignal", () => {
    if (!signalInitialized) {
      signalInitialized = true;
      return;
    }
    if (sessionData) {
      authOperationPending = true;
      authOpSettledPromise = new Promise<void>((resolve) => {
        authOpSettledResolve = resolve;
      });
    }
  });

  client.useSession().subscribe((session) => {
    const isAuthOpSettling = authOperationPending && !session.isRefetching;
    if (isAuthOpSettling) {
      authOperationPending = false;
      authOpSettledResolve?.();
      authOpSettledResolve = null;
      authOpSettledPromise = null;
    }

    sessionData = session.data;
    sessionPending = session.isPending;
    if (session.data) {
      sessionHasBeenAvailable = true;
    }
  });

  const fetchAccessToken: FetchAccessToken = async ({ forceRefreshToken }) => {
    if (!forceRefreshToken) return null;

    if (sessionHasBeenAvailable && !sessionData) return null;

    if (authOperationPending && authOpSettledPromise) {
      await Promise.race([
        authOpSettledPromise,
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]);
      if (sessionHasBeenAvailable && !sessionData) return null;
    }

    return fetchTokenWithRetry(client);
  };

  const serverState = typeof server === "function" ? server() : server;
  if (serverState?.isAuthenticated) {
    convexClient.setAuth(fetchAccessToken, () => {
      // Seed auth during hydration.
    });
  }

  let authActive = false;
  $effect(() => {
    const shouldAuthenticate = !!sessionData;
    void sessionPending;

    if (!shouldAuthenticate) {
      authActive = false;
      convexClient.setAuth(
        async () => null,
        () => {
          // noop
        },
      );
      return;
    }

    authActive = true;
    convexClient.setAuth(fetchAccessToken, () => {
      // Convex backend confirmation is handled internally by the client.
    });

    return () => {
      if (!authActive) return;
      authActive = false;
      convexClient.setAuth(
        async () => null,
        () => {
          // noop
        },
      );
    };
  });
}

export { syncConvex };
