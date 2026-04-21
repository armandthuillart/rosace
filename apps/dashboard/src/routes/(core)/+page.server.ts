import { signOut } from "$lib/auth";
import type { Actions } from "@sveltejs/kit";

export const actions = { default: signOut } satisfies Actions;
