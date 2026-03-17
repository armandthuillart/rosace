"use client";

import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import type { AuthTokenFetcher } from "convex/browser";
import { ConvexProviderWithAuth, useConvexAuth } from "convex/react";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useSyncExternalStore,
} from "react";
import { createStore, type StoreApi } from "zustand/vanilla";

type AuthClient = {
	useSession: () => { data: unknown; isPending: boolean };
} & Record<string, unknown>;

/**
 * Better Auth client shape extended with the custom Convex plugin endpoints
 * used by this package to fetch fresh JWTs.
 */
type AuthClientWithConvexPlugin = AuthClient & {
	convex?: {
		getJwt?: (opts?: {
			fetchOptions?: {
				throw?: boolean;
			};
		}) => Promise<{
			data?: { jwt?: string | null; token?: string | null } | null;
		}>;
		getToken?: (opts?: {
			fetchOptions?: {
				throw?: boolean;
			};
		}) => Promise<{
			data?: { jwt?: string | null; token?: string | null } | null;
		}>;
	};
};

/**
 * Minimal subset of the Convex React client API required by
 * `ConvexProviderWithAuth`.
 */
interface ConvexReactClientWithAuth {
	clearAuth: () => void;
	setAuth: (fetchToken: AuthTokenFetcher) => void;
}

/**
 * Function passed to Convex so it can retrieve a JWT on demand.
 */
type FetchAccessTokenFn = (args?: {
	forceRefreshToken?: boolean;
}) => Promise<string | null>;

/**
 * Client-side auth state shared between the provider internals and consumers
 * that need auth-aware behavior.
 */
interface AuthStoreState {
	expiresAt: number | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	isUnauthorized: (error: unknown) => boolean;
	jwt: string | null;
	onMutationUnauthorized: () => void;
	onQueryUnauthorized: (info: { queryName: string }) => void;
}

interface AuthContextProviderProps {
	children: ReactNode;
	initialValues: Pick<AuthStoreState, "expiresAt" | "jwt">;
	isUnauthorized?: (error: unknown) => boolean;
	onMutationUnauthorized?: () => void;
	onQueryUnauthorized?: (info: { queryName: string }) => void;
}

/**
 * Public provider props for the unified Better Auth + Convex + React Query
 * integration used by apps in this repo.
 */
interface ConvexProviderProps {
	authClient: AuthClient;
	children: ReactNode;
	convexQueryClient: ConvexQueryClient;
	initialJwt?: string;
	isUnauthorized?: (error: unknown) => boolean;
	onMutationUnauthorized?: () => void;
	onQueryUnauthorized?: (info: { queryName: string }) => void;
	queryClient: QueryClient;
}

const FetchAccessTokenContext = createContext<FetchAccessTokenFn | null>(null);
const AuthStoreContext = createContext<StoreApi<AuthStoreState> | null>(null);

const defaultMutationHandler = () => {
	throw new Error("Unauthorized mutation");
};

/**
 * Default unauthorized detection for both server-thrown Convex errors and
 * client-side auth errors.
 */
const defaultIsUnauthorized = (error: unknown): boolean => {
	if (!error || typeof error !== "object") {
		return false;
	}

	if ("data" in error) {
		const { data } = error as { data: unknown };

		if (data && typeof data === "object" && "code" in data) {
			return (data as { code: string }).code === "UNAUTHORIZED";
		}
	}

	if ("code" in error) {
		return (error as { code: string }).code === "UNAUTHORIZED";
	}

	return false;
};

/**
 * Returns true when Better Auth has resolved a session object that we can trust
 * as authenticated.
 */
const hasActiveSessionData = (session: unknown) => {
	if (!session || typeof session !== "object") {
		return false;
	}

	return Boolean((session as { session?: unknown }).session);
};

/**
 * Decodes the JWT expiration timestamp in milliseconds.
 */
function decodeJwtExp(jwt: string): number | null {
	try {
		const payload = JSON.parse(atob(jwt.split(".")[1]));
		return payload.exp ? payload.exp * 1000 : null;
	} catch {
		return null;
	}
}

/**
 * Creates the internal auth store used to keep optimistic JWT state in sync
 * with Convex auth state.
 */
function createAuthStore(
	initialValues: Pick<AuthStoreState, "expiresAt" | "jwt">,
): StoreApi<AuthStoreState> {
	return createStore<AuthStoreState>(() => ({
		expiresAt: initialValues.expiresAt,
		isAuthenticated: false,
		isLoading: true,
		isUnauthorized: defaultIsUnauthorized,
		jwt: initialValues.jwt,
		onMutationUnauthorized: defaultMutationHandler,
		onQueryUnauthorized: () => {},
	}));
}

/**
 * Provides the auth store instance and hydrates runtime auth callbacks without
 * recreating the store.
 */
function AuthContextProvider({
	children,
	initialValues,
	isUnauthorized,
	onMutationUnauthorized,
	onQueryUnauthorized,
}: AuthContextProviderProps) {
	const storeRef = useRef<StoreApi<AuthStoreState> | null>(null);

	if (!storeRef.current) {
		storeRef.current = createAuthStore(initialValues);
	}

	useEffect(() => {
		storeRef.current?.setState({
			isUnauthorized: isUnauthorized ?? defaultIsUnauthorized,
			onMutationUnauthorized: onMutationUnauthorized ?? defaultMutationHandler,
			onQueryUnauthorized: onQueryUnauthorized ?? (() => {}),
		});
	}, [isUnauthorized, onMutationUnauthorized, onQueryUnauthorized]);

	return (
		<AuthStoreContext.Provider value={storeRef.current}>
			{children}
		</AuthStoreContext.Provider>
	);
}

/**
 * Returns the internal auth store API.
 */
function useAuthStoreApi() {
	const store = useContext(AuthStoreContext);

	if (!store) {
		throw new Error("ConvexProvider auth store is missing.");
	}

	return store;
}

/**
 * Reads a single value from the internal auth store.
 */
function useAuthValue<T>(selector: (state: AuthStoreState) => T) {
	const store = useAuthStoreApi();

	return useSyncExternalStore(
		store.subscribe,
		() => selector(store.getState()),
		() => selector(store.getInitialState()),
	);
}

/**
 * Top-level provider that connects authentication, Convex, and TanStack Query,
 * and can preload auth state from an initial JWT (e.g. for SSR).
 */
function ConvexBetterAuthProvider({
	authClient,
	children,
	convexQueryClient,
	initialJwt,
	isUnauthorized,
	onMutationUnauthorized,
	onQueryUnauthorized,
	queryClient,
}: ConvexProviderProps) {
	const initialValues = {
		expiresAt: initialJwt ? decodeJwtExp(initialJwt) : null,
		jwt: initialJwt ?? null,
	};

	return (
		<AuthContextProvider
			initialValues={initialValues}
			isUnauthorized={isUnauthorized}
			onMutationUnauthorized={onMutationUnauthorized}
			onQueryUnauthorized={onQueryUnauthorized}
		>
			<ConvexProviderInner
				authClient={authClient}
				convexQueryClient={convexQueryClient}
				queryClient={queryClient}
			>
				{children}
			</ConvexProviderInner>
		</AuthContextProvider>
	);
}

/**
 * Internal provider that owns token refresh, hydration-safe auth state, and
 * the Convex `useAuth` adapter.
 */
function ConvexProviderInner({
	authClient,
	children,
	convexQueryClient,
	queryClient,
}: {
	authClient: AuthClient;
	children: ReactNode;
	convexQueryClient: ConvexQueryClient;
	queryClient: QueryClient;
}) {
	const authStore = useAuthStoreApi();
	const { data: session, isPending } = authClient.useSession();
	const sessionRef = useRef(session);
	const isPendingRef = useRef(isPending);
	const pendingJwtRef = useRef<Promise<string | null> | null>(null);

	sessionRef.current = session;
	isPendingRef.current = isPending;

	useEffect(() => {
		if (!(hasActiveSessionData(session) || isPending)) {
			authStore.setState({
				expiresAt: null,
				isAuthenticated: false,
				jwt: null,
			});
		}
	}, [authStore, isPending, session]);

	const fetchAccessToken: FetchAccessTokenFn = async ({
		forceRefreshToken = false,
	} = {}) => {
		const fetchFreshJwt = () => {
			if (pendingJwtRef.current) {
				return pendingJwtRef.current;
			}

			const clientWithConvexPlugin = authClient as AuthClientWithConvexPlugin;
			const getJwt =
				clientWithConvexPlugin.convex?.getJwt ??
				clientWithConvexPlugin.convex?.getToken;

			if (!getJwt) {
				console.error(
					"[ConvexProvider] Missing authClient.convex.getJwt/getToken().",
				);
				authStore.setState({ expiresAt: null, jwt: null });
				return Promise.resolve(null);
			}

			pendingJwtRef.current = getJwt({ fetchOptions: { throw: false } })
				.then((result) => {
					const jwt = result.data?.jwt ?? result.data?.token ?? null;

					authStore.setState({
						expiresAt: jwt ? decodeJwtExp(jwt) : null,
						jwt,
					});

					return jwt;
				})
				.catch((error: unknown) => {
					authStore.setState({ expiresAt: null, jwt: null });
					console.error("[ConvexProvider] Failed to fetch JWT.", error);
					return null;
				})
				.finally(() => {
					pendingJwtRef.current = null;
				});

			return pendingJwtRef.current;
		};

		const fetchFreshJwtForced = async () => {
			if (pendingJwtRef.current) {
				const jwt = await pendingJwtRef.current;

				if (jwt) {
					return jwt;
				}
			}

			return fetchFreshJwt();
		};

		const currentSession = sessionRef.current;
		const currentIsPending = isPendingRef.current;
		const hasSession = hasActiveSessionData(currentSession);

		if (!hasSession) {
			if (currentIsPending) {
				if (!forceRefreshToken) {
					return authStore.getState().jwt;
				}

				const cachedJwt = authStore.getState().jwt;
				const freshJwt = await fetchFreshJwtForced();

				if (!freshJwt && cachedJwt) {
					authStore.setState({
						expiresAt: decodeJwtExp(cachedJwt),
						jwt: cachedJwt,
					});
					return cachedJwt;
				}

				return freshJwt;
			}
			authStore.setState({ expiresAt: null, jwt: null });
			return null;
		}

		const { expiresAt, jwt } = authStore.getState();
		const timeRemaining = expiresAt ? expiresAt - Date.now() : 0;

		if (!forceRefreshToken && jwt && expiresAt && timeRemaining >= 60_000) {
			return jwt;
		}

		if (!forceRefreshToken && pendingJwtRef.current) {
			return pendingJwtRef.current;
		}

		return forceRefreshToken ? fetchFreshJwtForced() : fetchFreshJwt();
	};

	const useAuth = function useConvexAuthHook() {
		const { jwt } = authStore.getState();
		const hasSession = hasActiveSessionData(sessionRef.current);
		const sessionMissing = !(hasSession || isPendingRef.current);

		return {
			fetchAccessToken,
			isAuthenticated: sessionMissing ? false : hasSession || jwt !== null,
			isLoading: isPendingRef.current && !jwt,
		};
	};

	return (
		<QueryClientProvider client={queryClient}>
			<FetchAccessTokenContext.Provider value={fetchAccessToken}>
				<ConvexProviderWithAuth
					client={convexQueryClient.convexClient as ConvexReactClientWithAuth}
					useAuth={useAuth}
				>
					<AuthStateSync>{children}</AuthStateSync>
				</ConvexProviderWithAuth>
			</FetchAccessTokenContext.Provider>
		</QueryClientProvider>
	);
}

/**
 * Mirrors Convex auth state back into the local auth store.
 *
 * When a JWT exists during hydration but Convex has not confirmed it yet, this
 * keeps the app in a loading state to avoid transient unauthenticated flashes.
 */
function AuthStateSync({ children }: { children: ReactNode }) {
	const { isAuthenticated, isLoading: convexIsLoading } = useConvexAuth();
	const authStore = useAuthStoreApi();
	const jwt = useAuthValue((state) => state.jwt);

	useEffect(() => {
		const hasJwtButNotAuth = Boolean(jwt) && !isAuthenticated;
		const isLoading = convexIsLoading || hasJwtButNotAuth;

		authStore.setState({
			isAuthenticated,
			isLoading,
		});
	}, [authStore, convexIsLoading, isAuthenticated, jwt]);

	return children;
}

export { ConvexBetterAuthProvider };

