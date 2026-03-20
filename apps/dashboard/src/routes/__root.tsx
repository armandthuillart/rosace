/// <reference types="vite/client" />

import type { ConvexQueryClient } from "@convex-dev/react-query";
import globalsCss from "@repo/ui/globals.css?url";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ThemeProvider } from "better-themes";
import type { ReactNode } from "react";
import { ConvexProvider } from "@/components/convex-provider";
import { getJwt } from "@/lib/auth";
import appCss from "@/styles/app.css?url";
import { seo } from "@/utils/seo";

const getAuth = createServerFn({ method: "GET" }).handler(
	async () => await getJwt(),
);

const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
}>()({
	beforeLoad: async (opts) => {
		const jwt = await getAuth();

		if (jwt) {
			opts.context.convexQueryClient.serverHttpClient?.setAuth(jwt);
		}

		return {
			isAuth: Boolean(jwt),
			jwt,
		};
	},
	component: RootComponent,
	head: () => ({
		links: [
			{ href: appCss, rel: "stylesheet" },
			{ href: globalsCss, rel: "stylesheet" },
			{
				href: "/favicon-dark.svg",
				media: "(prefers-color-scheme: dark)",
				rel: "icon",
				type: "image/svg+xml",
			},
			{
				href: "/favicon-light.svg",
				media: "(prefers-color-scheme: light)",
				rel: "icon",
				type: "image/svg+xml",
			},
		],
		meta: [
			{ charSet: "utf-8" },
			{ content: "width=device-width, initial-scale=1.0", name: "viewport" },
			...seo({ title: "Rosace" }),
		],
	}),
});

function RootComponent() {
	return (
		<ConvexProvider>
			<RootDocument>
				<Outlet />
			</RootDocument>
		</ConvexProvider>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html className="antialiased" lang="en" suppressHydrationWarning={true}>
			<head>
				<HeadContent />
			</head>

			<body className="bg-background text-foreground">
				<ThemeProvider attribute="class" disableTransitionOnChange={true}>
					{children}
				</ThemeProvider>

				<Scripts />
			</body>
		</html>
	);
}

export { Route };
