import { svelteAuth } from "@repo/auth/svelte/server";

export const { handle, login, logout } = svelteAuth();
