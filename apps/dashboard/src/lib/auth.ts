import { useAuth } from "@repo/auth/sveltekit";

export const { handle, signIn, signOut } = useAuth();
