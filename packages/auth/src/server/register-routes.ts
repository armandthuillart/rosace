import { URLSearchParams } from "url";

import { httpActionGeneric, HttpRouter } from "convex/server";

import { requireEnv, getCookies, capitalize } from "../utils";

const getHeaders = () =>
  new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=60, stale-if-error=86400",
  });

const registerRoutes = (http: HttpRouter) => {
  http.route({
    path: "/.well-known/openid-configuration",
    method: "GET",
    handler: httpActionGeneric(async () => {
      let issuer = requireEnv("CONVEX_SITE_URL");

      return new Response(
        JSON.stringify({
          authorization_endpoint: issuer + "/oauth/authorize",
          jwks_uri: issuer + "/.well-known/jwks.json",
          issuer,
        }),
        { headers: getHeaders(), status: 200 },
      );
    }),
  });

  http.route({
    path: "/.well-known/jwks.json",
    method: "GET",
    handler: httpActionGeneric(async () => {
      return new Response(requireEnv("JWKS"), {
        headers: getHeaders(),
        status: 200,
      });
    }),
  });

  http.route({
    pathPrefix: "/auth/login/",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const provider = url.pathname.replace(/\/+$/, "").split("/").at(-1);

      if (!provider) {
        return new Response("Pick a provider.", { status: 400 });
      }

      if (provider !== "google" && provider !== "apple") {
        return new Response(`${capitalize(provider)} is not supported.`, { status: 400 });
      }

      const verifier = url.searchParams.get("code");

      if (!verifier) {
        return new Response("Malformed request.", { status: 400 });
      }

      const redirectTo = url.searchParams.get("redirectTo");

      const cookies = getCookies(request);

      return new Response(null, { status: 200 });
    }),
  });

  http.route({
    pathPrefix: "/auth/logout/",
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      const origin = request.headers.get("origin");
      const trustedOrigin = requireEnv("DASHBOARD_URL");

      if (!origin || origin !== trustedOrigin) {
        return new Response(null, { status: 403 });
      }

      const cookies = getCookies(request);
      const sessionToken = cookies["auth:session"];

      if (sessionToken) {
        await ctx
          .runMutation("auth:store" as any, {
            args: { type: "logout", sessionToken },
          })
          .catch((error) => {
            console.error("auth/logout: failed to invalidate session", error);
          });
      }

      const headers = new Headers();

      headers.append(
        "Set-Cookie",
        "auth:session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      );
      headers.append(
        "Set-Cookie",
        "auth:token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      );

      return new Response(null, { headers, status: 204 });
    }),
  });

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
