import type { Cookies } from "@sveltejs/kit";
import { createCookieGetter } from "better-auth/cookies";

function getJWKS(cookies: Cookies) {
  const createCookie = createCookieGetter({});
  const cookie = createCookie("auth:jwks");
  const jwks = cookies.get(cookie.name);

  if (!jwks) {
    console.log("Reverse proxy detected. baseURL is not aligned with the external URL.");
  }

  return jwks;
}

export { getJWKS };
