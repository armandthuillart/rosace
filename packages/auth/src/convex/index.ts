// TODO: a working but vibe-coded mess to rewrite

import { throttler } from "@repo/convex/throttler";
import { requireEnv } from "@repo/helpers";
import { httpActionGeneric, type HttpRouter } from "convex/server";
import * as v from "valibot";

import {
  createPKCE,
  exchangeCodeForProfile,
  getAuthorizationUrl,
  type SocialProvider,
} from "../oauth/providers";
import { authStore, getPublicJwks } from "./store";

const STORE_QUERY = "auth:query" as const;
const STORE_ACTION = "auth:action" as const;
const STORE_MUTATION = "auth:mutation" as const;

const OAUTH_STATE_TTL_MS = 15 * 60_000;

type Provider = "credentials" | SocialProvider;

type SessionPayload = {
  accessToken: string;
  expiresAt: number;
  sessionToken: string;
};

type ProviderCheck =
  | { blocked: Response; provider: null }
  | { blocked: null; provider: Provider };

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
    flow:
      input.firstName && input.lastName
        ? ("register" as const)
        : ("login" as const),
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

  let requestOrigin: string;
  let trustedOrigin: string;
  try {
    trustedOrigin = new URL(requireEnv("DASHBOARD_URL")).origin;
    requestOrigin = new URL(origin).origin;
  } catch {
    return new Response(null, { status: 403 });
  }

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

function requireAllowedProvider(
  request: Request,
  allowed: readonly Provider[],
): ProviderCheck {
  const provider = new URL(request.url).pathname
    .replace(/\/+$/, "")
    .split("/")
    .at(-1);

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
  const maxAgeSession = Math.max(
    1,
    Math.floor((payload.expiresAt - Date.now()) / 1000),
  );
  return [
    `session:token=${payload.sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSession}`,
  ];
}

function clearedAuthCookies() {
  return ["session:token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"];
}

function handoffCookie(code: string) {
  return `session:handoff=${code}; Path=/auth/session/claim; HttpOnly; Secure; SameSite=Lax; Max-Age=60`;
}

function clearedHandoffCookie() {
  return "session:handoff=; Path=/auth/session/claim; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
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
          "cache-control":
            "public, max-age=3600, stale-while-revalidate=60, stale-if-error=86400",
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
      const token = readCookies(request)["session:token"];

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

        for (const cookie of clearedAuthCookies())
          headers.append("Set-Cookie", cookie);

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
      const { ok, retryAfter } = await throttler.limit(ctx, "logout", {
        key: ipAddress,
      });
      if (!ok) {
        return new Response(null, {
          status: 429,
          headers: {
            "X-Retry-After": String(
              Math.ceil((retryAfter! - Date.now()) / 1000),
            ),
          },
        });
      }

      const token = readCookies(request)["session:token"];

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
      for (const cookie of clearedAuthCookies())
        headers.append("Set-Cookie", cookie);

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

      const { ok, retryAfter } = await throttler.limit(ctx, "oauth", {
        key: ipAddress,
      });

      if (!ok) {
        return new Response(null, {
          status: 429,
          headers: {
            "X-Retry-After": String(
              Math.ceil((retryAfter! - Date.now()) / 1000),
            ),
          },
        });
      }

      const provider = checked.provider as SocialProvider;
      const url = getAuthorizationUrl(provider);

      const state = crypto.randomUUID().replace(/-/g, "");
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const { verifier, challenge, method } = await createPKCE();

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
            type: "oauth:authorize",
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

      const { ok, retryAfter } = await throttler.limit(ctx, "login", {
        key: ipAddress,
      });

      if (!ok) {
        return new Response(null, {
          status: 429,
          headers: {
            "X-Retry-After": String(
              Math.ceil((retryAfter! - Date.now()) / 1000),
            ),
          },
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
          if (!firstName || !lastName)
            return new Response(null, { status: 400 });

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
                password: hash,
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
          )) as { userId: string; password: string } | null;

          if (!account) return new Response(null, { status: 401 });

          const { ok } = (await ctx.runAction(
            STORE_ACTION as unknown as never,
            {
              payload: {
                type: "password:verify",
                password: payload.password,
                hash: account.password,
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
                password: account.password,
              },
            } as never,
          )) as SessionPayload;
        }
      } catch {
        return new Response(null, { status: 401 });
      }

      const headers = new Headers({ "content-type": "application/json" });
      for (const cookie of sessionCookies(session))
        headers.append("Set-Cookie", cookie);

      return new Response(JSON.stringify({ ok: true }), {
        headers,
        status: 200,
      });
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
        payload: { type: "oauth:verify", provider, state },
      } as never,
    )) as { nonce: string; verifier?: string } | null;

    if (!consumed) {
      return new Response("Invalid or expired state.", { status: 400 });
    }

    let profile;
    try {
      profile = await exchangeCodeForProfile(provider, {
        code,
        nonce: consumed.nonce,
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

    const { code: handoff } = (await ctx.runMutation(
      STORE_MUTATION as unknown as never,
      {
        payload: {
          type: "oauth:finalize",
          provider,
          accountId: profile.accountId,
          email: profile.email,
          emailVerified: profile.emailVerified,
          firstName: profile.firstName,
          lastName: profile.lastName,
        } as never,
      },
    )) as { code: string };

    const dashboard = requireEnv("DASHBOARD_URL");

    const headers = new Headers({
      Location: `${dashboard}/auth/session/claim`,
    });
    headers.append("Set-Cookie", handoffCookie(handoff));
    return new Response(null, { headers, status: 302 });
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
      const handoff = readCookies(request)["session:handoff"];
      if (!handoff) {
        const headers = new Headers();
        headers.append("Set-Cookie", clearedHandoffCookie());
        return new Response("Missing code.", { headers, status: 400 });
      }

      const claimed = (await ctx.runMutation(
        STORE_MUTATION as never,
        {
          payload: { type: "oauth:claim", code: handoff },
        } as never,
      )) as SessionPayload | null;

      if (!claimed) {
        const headers = new Headers();
        headers.append("Set-Cookie", clearedHandoffCookie());
        return new Response("Invalid or expired handoff.", {
          headers,
          status: 400,
        });
      }

      const headers = new Headers({ Location: "/" });
      headers.append("Set-Cookie", clearedHandoffCookie());
      for (const cookie of sessionCookies(claimed))
        headers.append("Set-Cookie", cookie);

      return new Response(null, { headers, status: 302 });
    }),
  });
};

function convexAuth() {
  return {
    authStore,
    registerRoutes,
  };
}

export { convexAuth };
