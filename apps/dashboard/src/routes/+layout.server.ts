import { convexQuery } from "@repo/better-auth/convex";
import { api } from "@repo/convex/api";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const token = locals.token;
  if (!token) return { token: false };
  const user = await convexQuery(api.user.getUser, { token });
  return { token: true, user };
};
