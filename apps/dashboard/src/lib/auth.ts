import { svelteAuth } from "@repo/auth/sveltekit";

export const { handle, login, logout } = svelteAuth();
