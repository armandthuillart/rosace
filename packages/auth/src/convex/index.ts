// TODO: a working vibe-coded mess to rewrite

import { rateLimiter } from "@repo/convex/rate-limiter";
import { requireEnv } from "@repo/helpers";
import { httpActionGeneric, type HttpRouter } from "convex/server";
import * as v from "valibot";

import { createPkce, exchangeCode, getAuthorizationUrl, type SocialProvider } from "../providers";
import { getPublicJwks, authStore } from "./store";

const STORE_QUERY = "store:query" as const;
const STORE_ACTION = "store:action" as const;
const STORE_MUTATION = "store:mutation" as const;

const OAUTH_STATE_TTL_MS = 15 * 60_000;

type Provider = "credentials" | SocialProvider;

type SessionPayload = {
  accessToken: string;
  expiresAt: number;
  sessionToken: string;
};

type ProviderCheck = { blocked: Response; provider: null } | { blocked: null; provider: Provider };

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

function readCookies(request: Request): Record<string, string> {
  const header = request.headers.get("cookie") ?? "";
  const cookies: Record<string, string> = {};

  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;

    const key = part.slice(0, i).trim();
    if (!key) continue;

    const value = part.slice(i + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      continue;
    }
  }

  return cookies;
}

function verifyCsrf(request: Request): Response | null {
  if (request.method !== "POST") return null;

  const origin = request.headers.get("origin");
  if (!origin) return new Response(null, { status: 403 });

  const trustedOrigin = new URL(requireEnv("DASHBOARD_URL")).origin;
  const requestOrigin = new URL(origin).origin;

  if (requestOrigin !== trustedOrigin) {
    return new Response(null, { status: 403 });
  }

  return null;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function requireAllowedProvider(request: Request, allowed: readonly Provider[]): ProviderCheck {
  const provider = new URL(request.url).pathname.replace(/\/+$/, "").split("/").at(-1);

  if (!provider) {
    return {
      provider: null,
      blocked: new Response("Pick a provider.", { status: 400 }),
    };
  }

  if (!allowed.includes(provider as Provider)) {
    const label = provider.charAt(0).toUpperCase() + provider.slice(1);
    return {
      provider: null,
      blocked: new Response(`${label} is not supported.`, { status: 400 }),
    };
  }

  return {
    provider: provider as Provider,
    blocked: null,
  };
}

function sessionCookies(payload: SessionPayload) {
  const maxAgeSession = Math.max(1, Math.floor((payload.expiresAt - Date.now()) / 1000));
  return [
    `session:refresh=${payload.sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSession}`,
  ];
}

function clearedAuthCookies() {
  return ["session:refresh=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"];
}

const registerRoutes = (http: HttpRouter) => {
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
    /**
     * Session endpoint - returns authenticated user profile and Convex auth token.
     *
     * Response shape (NextAuth-compatible):
     * - Unauthenticated: `null`
     * - Authenticated: `{ user: {...}, token: string, expires: number }`
     *
     * Dual-purpose contract:
     * - `user` - Server-side session truth (identity, plan, verification status)
     * - `token` - Client-side Convex auth token (for convex.setAuth(token))
     * - `expires` - Token expiration timestamp (epoch ms)
     *
     * Security:
     * - Requires HttpOnly, Secure, SameSite=Lax session cookie
     * - Token is short-lived (15m) and never persisted client-side
     * - Cache-Control: no-store prevents intermediary caching
     */
    path: "/auth/session",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const token = readCookies(request)["session:refresh"];

      if (!token) {
        return new Response("null", {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      const auth = await ctx.runQuery(
        STORE_QUERY as unknown as never,
        {
          payload: { type: "session:get", token },
        } as never,
      );

      if (!auth) {
        const headers = new Headers({ "Content-Type": "application/json" });
        for (const cookie of clearedAuthCookies()) headers.append("Set-Cookie", cookie);

        return new Response("null", { headers, status: 200 });
      }

      return new Response(JSON.stringify(auth), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        status: 200,
      });
    }),
  });

  http.route({
    path: "/auth/logout",
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      const blocked = verifyCsrf(request);
      if (blocked) return blocked;

      const ipAddress = getClientIp(request);
      const { ok, retryAfter } = await rateLimiter.limit(ctx, "logout", { key: ipAddress });
      if (!ok) {
        return new Response(null, {
          status: 429,
          headers: { "X-Retry-After": String(Math.ceil((retryAfter! - Date.now()) / 1000)) },
        });
      }

      const token = readCookies(request)["session:refresh"];

      if (token) {
        await ctx
          .runMutation(
            STORE_MUTATION as unknown as never,
            {
              payload: { type: "session:revoke", token },
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
      const checked = requireAllowedProvider(request, ["apple", "google"]);
      if (checked.blocked) return checked.blocked;

      const ipAddress = getClientIp(request);

      const { ok, retryAfter } = await rateLimiter.limit(ctx, "oauth", {
        key: ipAddress,
      });

      if (!ok) {
        return new Response(null, {
          status: 429,
          headers: { "X-Retry-After": String(Math.ceil((retryAfter! - Date.now()) / 1000)) },
        });
      }

      const provider = checked.provider as SocialProvider;
      const url = getAuthorizationUrl(provider);

      const state = crypto.randomUUID().replace(/-/g, "");
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const { verifier, challenge, method } = await createPkce();

      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);

      if (provider === "google") {
        url.searchParams.set("code_challenge", challenge);
        url.searchParams.set("code_challenge_method", method);
      }

      await ctx.runMutation(
        STORE_MUTATION as unknown as never,
        {
          payload: {
            type: "oauth:authorize:start",
            provider,
            state,
            nonce,
            expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
            verifier: provider === "google" ? verifier : undefined,
          },
        } as never,
      );

      return new Response(null, {
        headers: { Location: url.toString() },
        status: 302,
      });
    }),
  });

  http.route({
    pathPrefix: "/auth/login/",
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      const checked = requireAllowedProvider(request, ["credentials"]);
      if (checked.blocked) return checked.blocked;

      const blocked = verifyCsrf(request);
      if (blocked) return blocked;

      const ipAddress = getClientIp(request);

      const { ok, retryAfter } = await rateLimiter.limit(ctx, "login", {
        key: ipAddress,
      });

      if (!ok) {
        return new Response(null, {
          status: 429,
          headers: { "X-Retry-After": String(Math.ceil((retryAfter! - Date.now()) / 1000)) },
        });
      }

      let payload: v.InferOutput<typeof LoginSchema>;
      try {
        payload = v.parse(LoginSchema, await request.json());
      } catch {
        return new Response(null, { status: 400 });
      }

      let session: SessionPayload;
      try {
        if (payload.flow === "register") {
          const firstName = payload.firstName;
          const lastName = payload.lastName;
          if (!firstName || !lastName) return new Response(null, { status: 400 });

          const { hash } = (await ctx.runAction(
            STORE_ACTION as unknown as never,
            {
              payload: {
                type: "password:hash",
                password: payload.password,
              },
            } as never,
          )) as { hash: string };

          session = (await ctx.runMutation(
            STORE_MUTATION as unknown as never,
            {
              payload: {
                type: "credentials:register",
                email: payload.email,
                passwordHash: hash,
                firstName,
                lastName,
              },
            } as never,
          )) as SessionPayload;
        } else {
          const account = (await ctx.runMutation(
            STORE_MUTATION as unknown as never,
            {
              payload: {
                type: "credentials:login",
                email: payload.email,
              },
            } as never,
          )) as { userId: string; passwordHash: string } | null;

          if (!account) return new Response(null, { status: 401 });

          const { ok } = (await ctx.runAction(
            STORE_ACTION as unknown as never,
            {
              payload: {
                type: "password:verify",
                password: payload.password,
                hash: account.passwordHash,
              },
            } as never,
          )) as { ok: boolean };

          if (!ok) return new Response(null, { status: 401 });

          session = (await ctx.runMutation(
            STORE_MUTATION as unknown as never,
            {
              payload: {
                type: "credentials:login",
                email: payload.email,
                passwordHash: account.passwordHash,
              },
            } as never,
          )) as SessionPayload;
        }
      } catch {
        return new Response(null, { status: 401 });
      }

      const headers = new Headers({ "content-type": "application/json" });
      for (const cookie of sessionCookies(session)) headers.append("Set-Cookie", cookie);

      return new Response(JSON.stringify({ ok: true }), { headers, status: 200 });
    }),
  });

  const callbackAction = httpActionGeneric(async (ctx, request) => {
    const checked = requireAllowedProvider(request, ["apple", "google"]);
    if (checked.blocked) return checked.blocked;

    const provider = checked.provider as SocialProvider;

    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);
    const contentType = request.headers.get("content-type") ?? "";

    let userForm: string | null = null;

    if (contentType.startsWith("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      for (const [key, value] of Object.entries(formData)) {
        if (typeof value === "string") params.set(key, value);
      }
      userForm = params.get("user");
    }

    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      return new Response("Missing code or state.", { status: 400 });
    }

    const consumed = (await ctx.runMutation(
      STORE_MUTATION as unknown as never,
      {
        payload: { type: "oauth:authorize:consume-state", provider, state },
      } as never,
    )) as { nonce: string; verifier?: string } | null;

    if (!consumed) {
      return new Response("Invalid or expired state.", { status: 400 });
    }

    let profile;
    try {
      profile = await exchangeCode(provider, {
        code,
        userForm,
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
          type: "oauth:authenticate:finalize",
          provider,
          subject: profile.subject,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
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

function convexAuth() {
  return { authStore, registerRoutes };
}

export { convexAuth };
