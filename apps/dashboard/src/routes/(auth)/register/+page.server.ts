import { login } from "$lib/auth";

import type { Actions } from "./$types";

export const actions = { default: login } satisfies Actions;
