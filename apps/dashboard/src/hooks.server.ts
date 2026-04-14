import { getToken, setToken } from "@repo/better-auth/svelte";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const token = getToken(event.cookies);
  event.locals.token = token;
  return setToken(token, () => resolve(event));
};
