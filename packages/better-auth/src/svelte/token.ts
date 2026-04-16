import type { Cookies } from "@sveltejs/kit";
import { createCookieGetter } from "better-auth/cookies";

function getToken(cookies: Cookies): string | undefined {
  const createCookie = createCookieGetter({});
  const cookie = createCookie("auth:token");
  return cookies.get(cookie.name);
}

export { getToken };
