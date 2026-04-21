import { useAuth } from "@repo/auth/sveltekit";

export const { handle, signIn, signUp, signOut } = useAuth();
