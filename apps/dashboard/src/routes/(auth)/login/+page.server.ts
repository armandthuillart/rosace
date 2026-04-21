import { signIn } from "$lib/auth";
import { redirect, type Actions } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
  const data = await parent();
  if (data.user) throw redirect(302, "/");
  return {};
};

export const actions = { default: signIn } satisfies Actions;
