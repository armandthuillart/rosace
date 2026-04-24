import { httpActionGeneric, HttpRouter } from "convex/server";
import * as v from "valibot";

import { authorize } from "../providers/authorization-url";
import { exchangeProviderCode } from "../providers/exchange";
import { pkce } from "../providers/pkce";
import { SocialProvider } from "../types";
import { csrf, getCookies, getPublicJwks, guard, requireEnv } from "../utils";

const STORE_QUERY = "auth:storeQuery" as const;
const STORE_MUTATION = "auth:storeMutation" as const;

const OAUTH_STATE_TTL_MS = 15 * 60_000;
const ACCESS_TOKEN_TTL_S = 15 * 60;

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
    flow: input.firstName && input.lastName ? ("register" as const) : ("login" as const),
  })),
);

type SessionPayload = {
  accessToken: string;
  expiresAt: number;
  sessionToken: string;
};

function sessionCookies(payload: SessionPayload) {
  const maxAgeSession = Math.max(1, Math.floor((payload.expiresAt - Date.now()) / 1000));

  return [
    `auth:session=${payload.sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSession}`,
    `auth:token=${payload.accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ACCESS_TOKEN_TTL_S}`,
  ];
}

function clearedAuthCookies() {
  return [
    "auth:session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    "auth:token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  ];
}

const registerRoutes = (http: HttpRouter, socialProviders: SocialProvider[] = []) => {
  http.route({
    path: "/.well-known/openid-configuration",
    method: "GET",
    handler: httpActionGeneric(async () => {
      const issuer = requireEnv("CONVEX_SITE_URL");

      return new Response(
        JSON.stringify({
          authorization_endpoint: `${issuer}/oauth/authorize`,
          issuer,
          jwks_uri: `${issuer}/.well-known/jwks.json`,
        }),
        {
          headers: {
            "Cache-Control":
              "public, max-age=3600, stale-while-revalidate=60, stale-if-error=86400",
            "Content-Type": "application/json",
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
      return new Response(getPublicJwks(), {
        headers: {
          "cache-control": "public, max-age=3600, stale-while-revalidate=60, stale-if-error=86400",
          "content-type": "application/json",
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
      const token = cookies["auth:session"];

      if (!token) {
        return new Response("null", {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      const auth = await ctx.runQuery(
        STORE_QUERY as unknown as never,
        {
          payload: { token, type: "session:get" },
        } as never,
      );

      if (!auth) {
        const headers = new Headers({ "Content-Type": "application/json" });
        for (const cookie of clearedAuthCookies()) headers.append("Set-Cookie", cookie);

        return new Response("null", { headers, status: 200 });
      }

      return new Response(JSON.stringify(auth), {
        headers: { "Content-Type": "application/json" },
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
      const token = cookies["auth:session"];

      if (token) {
        await ctx
          .runMutation(
            STORE_MUTATION as unknown as never,
            {
              payload: { token, type: "session:delete" },
            } as never,
          )
          .catch((error) => {
            console.error("auth/logout: failed to invalidate session", error);
          });
      }

      const headers = new Headers();
      for (const cookie of clearedAuthCookies()) headers.append("Set-Cookie", cookie);

      return new Response(null, { headers, status: 204 });
    }),
  });

  http.route({
    pathPrefix: "/auth/login/",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const checked = guard(request, socialProviders);
      if (checked.blocked) return checked.blocked;

      const provider = checked.provider as SocialProvider;
      const { url } = authorize({ provider });

      const state = crypto.randomUUID().replace(/-/g, "");
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const { verifier, challenge, method } = await pkce();

      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);

      if (provider === "google") {
        url.searchParams.set("code_challenge", challenge);
        url.searchParams.set("code_challenge_method", method);
      }

      const headers = new Headers({ Location: url.toString() });

      await ctx.runMutation(
        STORE_MUTATION as unknown as never,
        {
          payload: {
            expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
            nonce,
            provider,
            state,
            type: "oauth:start",
            verifier: provider === "google" ? verifier : undefined,
          },
        } as never,
      );

      return new Response(null, { headers, status: 302 });
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

      let session: SessionPayload;
      try {
        session = (await ctx.runMutation(
          STORE_MUTATION as unknown as never,
          {
            payload: {
              email: payload.email,
              firstName: payload.firstName,
              flow: payload.flow,
              lastName: payload.lastName,
              password: payload.password,
              type: "credentials",
            },
          } as never,
        )) as SessionPayload;
      } catch {
        return new Response(null, { status: 401 });
      }

      const headers = new Headers({ "content-type": "application/json" });
      for (const cookie of sessionCookies(session)) headers.append("Set-Cookie", cookie);

      return new Response(JSON.stringify({ ok: true }), { headers, status: 200 });
    }),
  });

  const callbackAction = httpActionGeneric(async (ctx, request) => {
    const checked = guard(request, socialProviders);
    if (checked.blocked) return checked.blocked;

    const provider = checked.provider as SocialProvider;

    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);
    const contentType = request.headers.get("content-type") ?? "";

    let userFormField: string | null = null;
    if (contentType.startsWith("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") params.set(key, value);
      }
      userFormField = params.get("user");
    }

    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      return new Response("Missing code or state.", { status: 400 });
    }

    const consumed = (await ctx.runMutation(
      STORE_MUTATION as unknown as never,
      {
        payload: { provider, state, type: "oauth:consume" },
      } as never,
    )) as { nonce: string; verifier?: string } | null;

    if (!consumed) {
      return new Response("Invalid or expired state.", { status: 400 });
    }

    let profile;
    try {
      profile = await exchangeProviderCode(provider, code, {
        userForm: userFormField,
        verifier: consumed.verifier,
      });
    } catch (error) {
      console.error("auth/callback: provider exchange failed", error);
      return new Response("OAuth exchange failed.", { status: 400 });
    }

    if (!profile.email) {
      return new Response("Provider did not return an email.", { status: 400 });
    }

    const session = (await ctx.runMutation(
      STORE_MUTATION as unknown as never,
      {
        payload: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          provider,
          subject: profile.subject,
          type: "oauth:complete",
          verified: profile.verified,
        },
      } as never,
    )) as SessionPayload;

    const { code: handoff } = (await ctx.runMutation(
      STORE_MUTATION as unknown as never,
      {
        payload: {
          type: "oauth:handoff:issue",
          sessionToken: session.sessionToken,
          accessToken: session.accessToken,
          expiresAt: session.expiresAt,
        },
      } as never,
    )) as { code: string };

    const dashboard = requireEnv("DASHBOARD_URL");
    return new Response(null, {
      headers: { Location: `${dashboard}/auth/session/claim?code=${handoff}` },
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

  http.route({
    path: "/auth/session/claim",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const handoff = new URL(request.url).searchParams.get("code");
      if (!handoff) return new Response("Missing code.", { status: 400 });

      const claimed = (await ctx.runMutation(
        STORE_MUTATION as unknown as never,
        {
          payload: { type: "oauth:handoff:claim", code: handoff },
        } as never,
      )) as SessionPayload | null;

      if (!claimed) return new Response("Invalid or expired handoff.", { status: 400 });

      const headers = new Headers({ Location: "/" });
      for (const cookie of sessionCookies(claimed)) headers.append("Set-Cookie", cookie);

      return new Response(null, { headers, status: 302 });
    }),
  });
};

export { registerRoutes };
