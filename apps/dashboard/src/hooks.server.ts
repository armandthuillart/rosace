import { getToken } from "@repo/better-auth/svelte";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.token = getToken(event.cookies);
  return resolve(event);
};
