import { signUp } from "$lib/auth";
import type { Actions } from "@sveltejs/kit";

export const actions = { default: signUp } satisfies Actions;
