import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const Route = createFileRoute("/(auth)/login")({
	beforeLoad: ({ context }) => {
		if (context.isAuth) {
			throw redirect({
				to: "/",
			});
		}
	},
	component: RouteComponent,
	validateSearch: z.object({
		email: z.string().default(""),
		step: z
			.enum(["enter-code", "enter-email", "enter-password", "reset-password"])
			.default("enter-email"),
	}),
});

function RouteComponent() {
	const { email, step } = Route.useSearch();
	return <div />;
}

export { Route };
