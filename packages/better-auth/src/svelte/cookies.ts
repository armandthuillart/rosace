import type { Cookies } from "@sveltejs/kit";
import { createCookieGetter } from "better-auth/cookies";

function getToken(cookies: Cookies) {
  const createCookie = createCookieGetter({});
  const cookie = createCookie("auth:token");
  const token = cookies.get(cookie.name);

  return token;
}

export { getToken };
