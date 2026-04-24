import { URLSearchParams } from "url";

import { httpActionGeneric, HttpRouter } from "convex/server";
import * as v from "valibot";

import { authorize } from "../providers/authorization-url";
import { pkce } from "../providers/pkce";
import { SocialProvider } from "../types";
import { requireEnv, getCookies, guard, csrf } from "../utils";

const LoginSchema = v.pipe(
  v.object({
    email: v.pipe(v.string(), v.trim(), v.email()),
    password: v.pipe(v.string(), v.minLength(8)),
    firstName: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
    lastName: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  }),
  v.transform((input) => ({
    ...input,
    email: input.email.toLowerCase(),
    flow: input.firstName && input.lastName ? "register" : "login",
  })),
);

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
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control":
              "public, max-age=3600, stale-while-revalidate=60, stale-if-error=86400",
          },
          status: 200,
        },
      );
    }),
  });

  http.route({
    path: "/.well-known/jwks.json",
    method: "GET",
    handler: httpActionGeneric(async () => {
      return new Response(requireEnv("JWKS"), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=3600, stale-while-revalidate=60, stale-if-error=86400",
        },
        status: 200,
      });
    }),
  });

  http.route({
    path: "/auth/session",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const cookies = getCookies(request);
      const session = { token: cookies["auth:session"] };

      if (!session.token) {
        return new Response("null", {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        });
      }

      const auth = await ctx.runQuery("auth:store" as any, {
        type: "session:get",
        session,
      });

      if (!auth) {
        const headers = new Headers({
          "Content-Type": "application/json",
        });

        headers.append(
          "Set-Cookie",
          "auth:session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
        );
        headers.append(
          "Set-Cookie",
          "auth:token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
        );

        return new Response(null, {
          status: 200,
          headers,
        });
      }

      // TODO:
      // 1) hash sessionToken with AUTH_SECRET (same as logout)
      // 2) lookup sessions by refreshTokenHash
      // 3) check expiresAt > Date.now()
      // 4) fetch user by session.userId
      // 5) return auth payload shape expected by sveltekit/types.ts

      return new Response("null", {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    }),
  });

  http.route({
    pathPrefix: "/auth/login/",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const checked = guard(request, ["google", "apple"]);
      if (checked.blocked) return checked.blocked;

      const provider = checked.provider as SocialProvider;
      const { url } = authorize({ provider });

      const state = crypto.randomUUID().replace(/-/g, "");
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const { verifier, challenge, method } = pkce();

      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);

      if (provider === "google") {
        url.searchParams.set("code_challenge", challenge);
        url.searchParams.set("code_challenge_method", method);
      }

      const headers = new Headers();
      headers.set("Location", url.toString());

      headers.append(
        "Set-Cookie",
        `auth:state=${state}; Path=/auth/callback/${provider}; HttpOnly; Secure; SameSite=Lax; Max-Age=900`,
      );
      headers.append(
        "Set-Cookie",
        `auth:nonce=${nonce}; Path=/auth/callback/${provider}; HttpOnly; Secure; SameSite=Lax; Max-Age=900`,
      );

      if (provider === "google") {
        headers.append(
          "Set-Cookie",
          `auth:pkce=${verifier}; Path=/auth/callback/${provider}; HttpOnly; Secure; SameSite=Lax; Max-Age=900`,
        );
      }

      await ctx.runMutation("auth:store" as any, {
        type: "oauth:start",
        state,
        nonce,
        verifier: provider === "google" ? verifier : undefined,
        provider,
        expiresAt: Date.now() + 15 * 60_000,
      });

      return new Response(null, {
        headers,
        status: 302,
      });
    }),
  });

  http.route({
    pathPrefix: "/auth/login/",
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      const checked = guard(request, ["credentials"]);
      if (checked.blocked) return checked.blocked;

      const blocked = csrf(request);
      if (blocked) return blocked;

      let payload: v.InferOutput<typeof LoginSchema>;

      try {
        payload = v.parse(LoginSchema, await request.json());
      } catch {
        return new Response(null, { status: 400 });
      }

      const result = await ctx.runMutation("auth:store" as any, {
        type: "credentials",
        flow: payload.flow,
        email: payload.email,
        password: payload.password,
        lastName: payload.lastName,
        firstName: payload.firstName,
      });

      // TODO:
      // set auth:session / auth:token cookies from result
      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
      });
    }),
  });

  http.route({
    path: "/auth/logout",
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      const blocked = csrf(request);
      if (blocked) return blocked;

      const cookies = getCookies(request);
      const sessionToken = cookies["auth:session"];

      if (sessionToken) {
        await ctx
          .runMutation("auth:store" as any, {
            args: {
              type: "logout",
              sessionToken,
            },
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

      return new Response(null, {
        status: 204,
        headers,
      });
    }),
  });

  const callbackAction = httpActionGeneric(async (_, request) => {
    const checked = guard(request, ["google", "apple"]);
    if (checked.blocked) return checked.blocked;

    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.startsWith("application/x-www-form-urlencoded")) {
      const formData = await request.formData();

      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") {
          searchParams.set(key, value);
        }
      }
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return new Response("Missing code or state.", { status: 400 });
    }

    const cookies = getCookies(request);

    // 5) TODO: validate state + pkce + nonce
    // 6) TODO: exchange code -> provider tokens
    // 7) TODO: load profile from provider
    // 8) TODO: create/link account in DB
    // 9) TODO: create session + set auth cookies

    return new Response(null, {
      headers: { Location: "/" },
      status: 302,
    });
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
