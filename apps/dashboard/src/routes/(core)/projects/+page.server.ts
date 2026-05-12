import { logout } from '$lib/auth';

import type { Actions } from './$types';

export const actions = { default: logout } satisfies Actions;
