import { Handle } from "@sveltejs/kit";

const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("auth:token");
  event.locals.token = token ?? undefined;
  return resolve(event);
};

export { handle };
