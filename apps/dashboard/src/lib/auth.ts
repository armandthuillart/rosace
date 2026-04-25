import { svelteAuth } from "@repo/auth/svelte";

export const { handle, login, logout } = svelteAuth();
