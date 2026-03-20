import { convexQuery } from "@convex-dev/react-query";
import { api } from "@repo/convex/api";
import { createFileRoute, redirect } from "@tanstack/react-router";

const Route = createFileRoute("/(core)/")({
	beforeLoad: ({ context }) => {
		if (!context.isAuth) {
			throw redirect({ to: "/login" });
		}
	},
	component: RouteComponent,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(convexQuery(api.user.getUser));
	},
});

function RouteComponent() {
	return <div>Cooking...</div>;
}

export { Route };
