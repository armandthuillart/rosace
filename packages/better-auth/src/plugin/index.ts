import { createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { type Jwk, jwt as jwtPlugin } from "better-auth/plugins";
import { BetterAuthPlugin } from "better-auth/types";
import { omit } from "convex-helpers";

const COOKIE = "auth:token";
const MAX_AGE = 900;

export const convex = () => {
  const issuer = process.env.DASHBOARD_URL!;
  const keys = (JSON.parse(process.env.JWKS || "[]") as Jwk[]).map((k) => ({
    ...k,
    createdAt: new Date(k.createdAt),
  }));

  const jwt = jwtPlugin({
    adapter: { getJwks: async () => keys },
    jwks: { keyPairConfig: { alg: "RS256" } },
    jwt: {
      expirationTime: `${MAX_AGE}s`,
      definePayload: ({ user, session }) => ({
        ...omit(user, ["id", "image"]),
        iat: Math.floor(Date.now() / 1000),
        sessionId: session.id,
      }),
      audience: "convex",
      issuer,
    },
  });

  const set = async (ctx: any) => {
    const { session, newSession, createAuthCookie } = ctx.context;
    if (!session && !newSession) return;

    const { token } = (await jwt.endpoints.getToken({
      ...ctx,
      method: "GET",
      headers: {},
      returnStatus: false,
      returnHeaders: false,
    })) as any;
    const { attributes, name } = createAuthCookie(COOKIE, { maxAge: MAX_AGE });
    ctx.setCookie(name, token, attributes);
  };

  const clear = async (ctx: any) => {
    const { createAuthCookie } = ctx.context;
    const { attributes, name } = createAuthCookie(COOKIE, { maxAge: 0 });
    ctx.setCookie(name, "", attributes);
  };

  return {
    endpoints: {
      token: createAuthEndpoint("/convex/token", { method: "GET" }, async (ctx) =>
        jwt.endpoints.getToken({
          ...ctx,
          method: "GET",
          returnStatus: false,
          returnHeaders: false,
        }),
      ),
    },
    hooks: {
      after: [
        {
          handler: createAuthMiddleware(set),
          matcher: (c: any) => /sign-in|sign-up|callback|oauth/.test(c.path || ""),
        },
        {
          handler: createAuthMiddleware(clear),
          matcher: (c: any) => /sign-out|delete-user|get-session/.test(c.path || ""),
        },
      ],
    },
    id: "convex",
  } satisfies BetterAuthPlugin;
};
