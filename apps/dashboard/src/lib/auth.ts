import { betterAuth } from "@repo/better-auth/tanstack-start";

export const { handler, getJwt } = betterAuth({
	baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
});
