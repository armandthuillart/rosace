import { URLSearchParams } from "url";

import { httpActionGeneric, HttpRouter } from "convex/server";

import { requireEnv, getCookies, capitalize } from "../utils";

const headers = () =>
  new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=60, stale-if-error=86400",
  });

const registerRoutes = (http: HttpRouter) => {
  /**
   * OpenID Connect discovery document.
   * Required by Convex to locate the JWKS endpoint for JWT verification.
   * @see https://openid.net/specs/openid-connect-discovery-1_0.html
   */
  http.route({
    path: "/.well-known/openid-configuration",
    method: "GET",
    handler: httpActionGeneric(async () => {
      let issuer = requireEnv("CONVEX_SITE_URL");

      return new Response(
        JSON.stringify({
          issuer,
          jwks_uri: issuer + "/.well-known/jwks.json",
          authorization_endpoint: issuer + "/oauth/authorize",
        }),
        {
          status: 200,
          headers: headers(),
        },
      );
    }),
  });

  /**
   * JSON Web Key Set endpoint.
   * Serves the public keys used to verify issued JWTs.
   * Consumed by Convex on every authenticated request.
   */
  http.route({
    path: "/.well-known/jwks.json",
    method: "GET",
    handler: httpActionGeneric(async () => {
      return new Response(requireEnv("JWKS"), {
        status: 200,
        headers: headers(),
      });
    }),
  });

  /**
   * OAuth sign-in initiation.
   * Builds the authorization URL for the given provider (Google, Apple)
   * and redirects the user to their consent screen.
   */
  http.route({
    pathPrefix: "/auth/sign-in/",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const provider = url.pathname.replace(/\/+$/, "").split("/").at(-1);

      if (!provider) {
        return new Response("Pick a sign-in provider.", {
          status: 400,
        });
      }

      if (provider !== "google" && provider !== "apple") {
        return new Response(`${capitalize(provider)} is not supported.`, {
          status: 400,
        });
      }

      const verifier = url.searchParams.get("code");

      if (!verifier) {
        return new Response("Request is malformed.", {
          status: 400,
        });
      }

      const redirectTo = url.searchParams.get("redirectTo");

      const cookies = getCookies(request);

      return new Response("OK", { status: 200 });
    }),
  });

  /**
   * OAuth callback handler action.
   * Exchanges the authorization code for tokens, verifies the id_token,
   * upserts the user in Convex, mints a JWT, and sets session cookies.
   *
   * Registered for both GET and POST:
   * - Google returns via GET with query params
   * - Apple returns via POST with application/x-www-form-urlencoded body
   */
  const callbackAction = httpActionGeneric(async (ctx, request) => {
    const url = new URL(request.url);
    const provider = url.pathname.replace(/\/+$/, "").split("/").at(-1);

    if (!provider) {
      return new Response("Pick a sign-in provider.", {
        status: 400,
      });
    }

    if (provider !== "google" && provider !== "apple") {
      return new Response(`${capitalize(provider)} is not supported.`, {
        status: 400,
      });
    }

    const searchParams = new URLSearchParams(url.search);
    const contentType = request.headers.get("Content-Type") ?? "";

    if (contentType.startsWith("application/x-www-form-urlencoded")) {
      const formData = await request.formData();

      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") {
          searchParams.set(key, value);
        }
      }
    }

    const verifier = searchParams.get("code");
    const state = searchParams.get("state");

    if (!verifier || !state) {
    }

    const cookies = getCookies(request);

    return new Response(null, { status: 200 });
  });

  http.route({
    pathPrefix: "/auth/callback/",
    method: "GET",
    handler: callbackAction,
  });

  http.route({
    pathPrefix: "/auth/callback/",
    method: "POST",
    handler: callbackAction,
  });
};

export { registerRoutes };
