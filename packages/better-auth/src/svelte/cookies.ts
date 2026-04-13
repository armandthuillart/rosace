import type { Cookies } from "@sveltejs/kit";
import { createCookieGetter } from "better-auth/cookies";

function getJWKS(cookies: Cookies) {
  const createCookie = createCookieGetter({});
  const cookie = createCookie("auth:jwks");
  const jwks = cookies.get(cookie.name);
  return jwks;
}

export { getJWKS };
