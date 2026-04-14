import { redirect } from "@sveltejs/kit";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, parent }) => {
  if (!locals.token) throw redirect(302, "/login");
  const data = await parent();
  return { user: data.user! };
};
