import { ConvexQueryClient } from "@convex-dev/react-query";
import { notifyManager, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { Error } from "@/components/error";
import { NotFound } from "@/components/not-found";
import { env } from "@/config/env";
import { routeTree } from "@/routeTree.gen";

function getRouter() {
	if (typeof document !== "undefined") {
		notifyManager.setScheduler(window.requestAnimationFrame);
	}

	const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL, {
		expectAuth: true,
	});

	const queryClient: QueryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryFn: convexQueryClient.queryFn(),
				queryKeyHashFn: convexQueryClient.hashFn(),
			},
		},
	});

	convexQueryClient.connect(queryClient);

	const router = createRouter({
		context: { convexQueryClient, queryClient },
		defaultErrorComponent: Error,
		defaultNotFoundComponent: NotFound,
		defaultPreload: "intent",
		routeTree,
		scrollRestoration: true,
	});

	setupRouterSsrQueryIntegration({
		queryClient,
		router,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}

export { getRouter };
