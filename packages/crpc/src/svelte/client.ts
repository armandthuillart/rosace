import { ConvexClient } from "convex/browser";
import { getContext, setContext, untrack } from "svelte";

type CrossDomainClient = ReturnType<typeof crossDomainClient>;
type ConvexClientBetterAuth = ReturnType<typeof convexClient>;
type PluginsWithCrossDomain = (
  | CrossDomainClient
  | ConvexClientBetterAuth
  | BetterAuthClientPlugin
)[];
type PluginsWithoutCrossDomain = (ConvexClientBetterAuth | BetterAuthClientPlugin)[];
type AuthClientWithPlugins<Plugins extends PluginsWithCrossDomain | PluginsWithoutCrossDomain> =
  ReturnType<
    typeof createAuthClient<
      BetterAuthClientOptions & {
        plugins: Plugins;
      }
    >
  >;
export type AuthClient =
  | AuthClientWithPlugins<PluginsWithCrossDomain>
  | AuthClientWithPlugins<PluginsWithoutCrossDomain>;

type ExtractSessionState<T> = T extends {
  subscribe(fn: (state: infer S) => void): unknown;
}
  ? S
  : never;
type SessionState = ExtractSessionState<ReturnType<AuthClient["useSession"]>>;

type FetchAccessToken = (options: { forceRefreshToken: boolean }) => Promise<string | null>;

// Context key for sharing auth client and functions
const AUTH_CONTEXT_KEY = Symbol("auth-context");

type BetterAuthContext = {
  authClient: AuthClient;
  fetchAccessToken: FetchAccessToken;
};

const _contextKey = "$$_convexClient";
export const _authContextKey = "$$_convexAuth";

export const useConvexClient = (): ConvexClient => {
  const client = getContext(_contextKey) as ConvexClient | undefined;
  if (!client) {
    throw new Error(
      "No ConvexClient was found in Svelte context. Did you forget to call setupConvex() in a parent component?",
    );
  }
  return client;
};

export type ConvexAuthProvider = {
  isLoading: boolean;
  isAuthenticated: boolean;
  fetchAccessToken: FetchAccessToken;
};

export type SetupAuthOptions = {
  initialState?: { isAuthenticated: boolean };
};

export type UseAuthReturn = {
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
};

type AuthContext = {
  isLoading: boolean;
  isAuthenticated: boolean;
};

export function setupAuth(
  authProvider: () => ConvexAuthProvider,
  options?: SetupAuthOptions,
): void {
  const client = useConvexClient();

  const hasInitialState = options?.initialState !== undefined;
  let isConvexAuthenticated: boolean | null = $state(
    hasInitialState ? (options?.initialState?.isAuthenticated ?? false) : null,
  );

  let providerHasSettled = false;
  let lastProcessedProviderAuth: boolean | undefined;

  let initialSetAuthActive = false;
  if (BROWSER && hasInitialState && options.initialState?.isAuthenticated) {
    const { fetchAccessToken } = authProvider();
    initialSetAuthActive = true;
    client.setAuth(fetchAccessToken, (backendIsAuthenticated: boolean) => {
      isConvexAuthenticated = backendIsAuthenticated;
    });
  }

  if (BROWSER) {
    flushDeferredSubscriptions();
  }

  $effect(() => {
    const {
      isLoading: providerLoading,
      isAuthenticated: providerAuth,
      fetchAccessToken,
    } = authProvider();

    if (!providerLoading) {
      providerHasSettled = true;
    }

    const currentConvexAuth = untrack(() => isConvexAuthenticated);
    lastProcessedProviderAuth = providerAuth;

    if (initialSetAuthActive) {
      if (providerAuth) {
        initialSetAuthActive = false;
        return () => {
          client.setAuth(
            async () => null,
            () => {},
          );
        };
      }
      return;
    }

    if (providerLoading && currentConvexAuth !== null && providerHasSettled) {
      isConvexAuthenticated = null;
    }

    if (!providerLoading && !providerAuth && currentConvexAuth !== false) {
      isConvexAuthenticated = false;
    }

    if (providerAuth) {
      if (currentConvexAuth === false) {
        isConvexAuthenticated = null;
      }

      let isThisEffectRelevant = true;

      client.setAuth(fetchAccessToken, (backendIsAuthenticated: boolean) => {
        if (isThisEffectRelevant) {
          isConvexAuthenticated = backendIsAuthenticated;
        }
      });

      return () => {
        isThisEffectRelevant = false;
        client.setAuth(
          async () => null,
          () => {},
        );
      };
    }
  });

  setContext<AuthContext>(_authContextKey, {
    get isLoading() {
      if (isConvexAuthenticated === null) return true;

      if (isConvexAuthenticated === false && lastProcessedProviderAuth !== undefined) {
        const currentProviderAuth = untrack(() => authProvider().isAuthenticated);
        if (currentProviderAuth !== lastProcessedProviderAuth) {
          return true;
        }
      }

      return false;
    },
    get isAuthenticated() {
      // Read eagerly so that any consumer $effect always registers a
      // dependency on isConvexAuthenticated, even when providerAuth is
      // currently false.  Without this, the `&&` short-circuits the
      // reactive read and effects like useQuery never re-run when auth
      // is later confirmed by the Convex backend.
      const convexAuth = isConvexAuthenticated;

      // Before the provider has settled, trust the SSR initial state.
      // The provider starts as loading (e.g. Better Auth session pending),
      // but the server already confirmed auth status.
      if (!providerHasSettled && hasInitialState) {
        return convexAuth === true;
      }

      // Once the Convex backend has confirmed auth, trust it.
      // The provider may report transient not-authenticated states
      // (e.g. during SvelteKit client-side navigation) that would
      // cause a flash.  The setupAuth effect corrects the state
      // for real sign-outs (provider → loading reset → false).
      if (convexAuth === true) {
        return true;
      }

      // Backend hasn't confirmed yet — also require the provider.
      // untrack: reading authProvider() here is for the current value only,
      // we don't want this getter to create additional subscriptions.
      const providerAuth = untrack(() => authProvider().isAuthenticated);
      return providerAuth && (convexAuth ?? false);
    },
  });
}

export function useAuth(): UseAuthReturn {
  const authContext = getContext<AuthContext | undefined>(_authContextKey);

  if (!authContext) {
    throw new Error(
      "useAuth() requires setupAuth() to be called in a parent component. " +
        "If you are using an auth adapter (e.g. convex-better-auth-svelte), " +
        "make sure its setup function is called before useAuth().",
    );
  }

  return {
    get isLoading() {
      return authContext.isLoading;
    },
    get isAuthenticated() {
      return authContext.isAuthenticated;
    },
  };
}

export function createSvelteAuthClient({
  authClient,
  convexUrl,
  convexClient,
  options,
  getServerState,
}: CreateSvelteAuthClientBaseArgs & { externalSession?: ExternalSession }) {
  return createSvelteAuthClientBrowser({
    authClient,
    convexUrl,
    convexClient,
    options,
    getServerState,
  });
}

const makeFetchAccessTokenBrowser = (
  authClient: AuthClient,
  getSessionData: () => SessionState["data"] | null,
  getAuthOperationPending: () => boolean,
  getAuthOpSettledPromise: () => Promise<void> | null,
  logVerbose: (message: string) => void,
): FetchAccessToken => {
  let sessionHasBeenAvailable = false;

  return async ({ forceRefreshToken }) => {
    if (!forceRefreshToken) return null;

    const currentSession = getSessionData();
    if (currentSession) {
      sessionHasBeenAvailable = true;
    }

    if (sessionHasBeenAvailable && !currentSession) {
      logVerbose("browser: session cleared, skipping token fetch");
      return null;
    }

    if (getAuthOperationPending()) {
      logVerbose("browser: auth operation pending, waiting for session to settle");
      const settledPromise = getAuthOpSettledPromise();
      if (settledPromise) {
        await Promise.race([settledPromise, new Promise<void>((r) => setTimeout(r, 2000))]);
      }
      const sessionAfterSettle = getSessionData();
      if (sessionHasBeenAvailable && !sessionAfterSettle) {
        logVerbose("browser: session cleared after auth op settled, skipping token fetch");
        return null;
      }
      logVerbose("browser: session still valid after auth op settled, proceeding");
    }

    const token = await fetchTokenBrowser(authClient, logVerbose);
    logVerbose("browser: returning retrieved token");
    return token;
  };
};

const fetchTokenBrowser = async (
  authClient: AuthClient,
  logVerbose: (message: string) => void,
): Promise<string | null> => {
  const initialBackoff = 100;
  const maxBackoff = 1000;
  let retries = 0;

  const nextBackoff = () => {
    const baseBackoff = initialBackoff * Math.pow(2, retries);
    retries += 1;
    const actualBackoff = Math.min(baseBackoff, maxBackoff);
    const jitter = actualBackoff * (Math.random() - 0.5);
    return actualBackoff + jitter;
  };

  const fetchWithRetry = async (): Promise<string | null> => {
    try {
      const { data } = await authClient.convex.token();
      return data?.token || null;
    } catch (e) {
      if (!isNetworkError(e)) {
        logVerbose(`fetchToken failed with non-network error: ${e}`);
        return null;
      }
      if (retries > 10) {
        logVerbose(`fetchToken failed with network error, giving up`);
        throw e;
      }
      const backoff = nextBackoff();
      logVerbose(`fetchToken failed with network error, attempting retrying in ${backoff}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchWithRetry();
    }
  };

  return fetchWithRetry();
};

function createSvelteAuthClientBrowser({
  authClient,
  convexUrl,
  convexClient: passedConvexClient,
  options,
  getServerState,
}: CreateSvelteAuthClientBaseArgs) {
  resolveConvexClient(convexUrl, passedConvexClient, options);

  let sessionData: SessionState["data"] | null = $state(null);
  let sessionPending: boolean = $state(true);

  let wasAuthenticated = false;
  let transientGuardTimer: ReturnType<typeof setTimeout> | null = null;

  let navigationPendingTimer: ReturnType<typeof setTimeout> | null = null;

  beforeNavigate(({ willUnload }) => {
    if (!willUnload && !sessionData) {
      sessionPending = true;
      if (navigationPendingTimer) clearTimeout(navigationPendingTimer);
      navigationPendingTimer = setTimeout(() => {
        navigationPendingTimer = null;
        sessionPending = false;
      }, 50);
    }
  });

  let authOperationPending = false;
  let signalInitialized = false;
  let authOpSettledResolve: (() => void) | null = null;
  let authOpSettledPromise: Promise<void> | null = null;

  authClient.$store.listen("$sessionSignal", () => {
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

  authClient.useSession().subscribe((session: SessionState) => {
    if (navigationPendingTimer) {
      clearTimeout(navigationPendingTimer);
      navigationPendingTimer = null;
    }

    const isRefetching = (session as Record<string, unknown>).isRefetching as boolean;
    const isAuthOpSettling = authOperationPending && !isRefetching;
    if (isAuthOpSettling) {
      authOperationPending = false;
      if (authOpSettledResolve) {
        authOpSettledResolve();
        authOpSettledResolve = null;
      }
      authOpSettledPromise = null;
    }

    if (transientGuardTimer) {
      clearTimeout(transientGuardTimer);
      transientGuardTimer = null;
    }

    if (session.data) {
      wasAuthenticated = true;
    }

    if (wasAuthenticated && !session.data && !session.isPending) {
      sessionData = null;

      if (isAuthOpSettling) {
        sessionPending = false;
        wasAuthenticated = false;
      } else {
        sessionPending = true;
        transientGuardTimer = setTimeout(() => {
          transientGuardTimer = null;
          sessionPending = false;
        }, 150);
      }
      return;
    }

    sessionData = session.data;
    sessionPending = session.isPending;
  });

  const logVerbose = (message: string) => {
    if (options?.verbose) {
      console.debug(`${new Date().toISOString()} ${message}`);
    }
  };

  const fetchAccessToken = makeFetchAccessTokenBrowser(
    authClient,
    () => sessionData,
    () => authOperationPending,
    () => authOpSettledPromise,
    logVerbose,
  );

  const serverState = getServerState?.();
  setupAuth(
    () => ({
      isLoading: sessionPending,
      isAuthenticated: !!sessionData,
      fetchAccessToken,
    }),
    serverState ? { initialState: { isAuthenticated: serverState.isAuthenticated } } : undefined,
  );

  setContext<BetterAuthContext>(AUTH_CONTEXT_KEY, {
    authClient,
    fetchAccessToken,
  });

  onMount(() => {
    handleOneTimeToken(authClient);
  });
}
