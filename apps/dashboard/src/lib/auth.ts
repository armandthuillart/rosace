import { svelteAuth } from "@repo/auth/svelte/server";

export const { handle, logout } = svelteAuth();
