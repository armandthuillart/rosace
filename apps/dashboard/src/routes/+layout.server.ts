import { api } from "@repo/convex/api";
import { createAuth } from "@repo/convex/auth";
import { proxy, getAuth } from "@repo/convex/svelte";

export const load = async ({ locals, cookies }) => {
  const http = proxy({ jwks: locals.jwks });
  const auth = await getAuth(createAuth, cookies);
  const user = await http.query(api.user.getUser);
  return { auth, user };
};
