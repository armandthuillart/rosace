import { ConvexBetterAuthProvider } from "@repo/better-auth/react";
import { useRouteContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

function ConvexProvider({ children }: { children: ReactNode }) {
	const { convexQueryClient, queryClient, jwt } = useRouteContext({
		from: "__root__",
	});

	return (
		<ConvexBetterAuthProvider
			authClient={authClient}
			convexQueryClient={convexQueryClient}
			initialJwt={jwt}
			queryClient={queryClient}
		>
			{children}
		</ConvexBetterAuthProvider>
	);
}

export { ConvexProvider };
