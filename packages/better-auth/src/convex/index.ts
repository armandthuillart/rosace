import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { bearer as bearerPlugin, type Jwk, jwt as jwtPlugin } from "better-auth/plugins";
import { omit } from "convex-helpers";
import type { AuthConfig, AuthProvider } from "convex/server";

const COOKIE_NAME = "auth:token";
const FIFTEEN_MINUTES = 60 * 15;

interface HookMatcherContext {
  context: { adapter: { options?: unknown } };
}

interface CookieHookMatcherContext {
  context: { session?: unknown };
  path?: string;
}

interface ConvexAdapterOptions {
  isRunMutationCtx?: boolean;
}

interface ConvexPluginOptions {
  baseURL: string;
  jwks: string;
  provider: Array<AuthConfig | AuthProvider>;
}

export function convex(options: ConvexPluginOptions): BetterAuthPlugin {
  const { baseURL, jwks } = options;

  const normalizeJwks = (keys: Jwk[]) =>
    keys.map((k) => ({
      ...k,
      createdAt: new Date(k.createdAt),
    }));

  const parsed = JSON.parse((jwks ?? "").trim() || "[]") as Jwk | Jwk[];

  const staticJwks = normalizeJwks(Array.isArray(parsed) ? parsed : [parsed]);

  const jwt = jwtPlugin({
    adapter: {
      getJwks: async () => {
        return staticJwks;
      },
    },
    jwks: {
      keyPairConfig: {
        alg: "RS256",
      },
    },
    jwt: {
      expirationTime: `${FIFTEEN_MINUTES}s`,
      definePayload: ({ user, session }) => ({
        ...omit(user, ["id", "image"]),
        iat: Math.floor(Date.now() / 1000),
        sessionId: session.id,
      }),
      audience: "convex",
      issuer: baseURL,
    },
  });

  const bearer = bearerPlugin();

  return {
    ...jwt,
    endpoints: {
      getToken: createAuthEndpoint("/convex/token", { method: "GET" }, async (ctx) =>
        jwt.endpoints.getJwks({
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
          handler: createAuthMiddleware(async (ctx) => {
            let {
              context: { session, newSession, createAuthCookie },
              setCookie,
            } = ctx;

            async function setJWT() {
              const originalSession = session;
              session = session ?? newSession;

              const { token } = await jwt.endpoints
                .getToken({
                  ...ctx,
                  method: "GET",
                  headers: {},
                  returnStatus: false,
                  returnHeaders: false,
                })
                .finally(() => {
                  session = originalSession;
                });

              const { attributes, name } = createAuthCookie(COOKIE_NAME, {
                maxAge: FIFTEEN_MINUTES,
              });

              setCookie(name, token, attributes);
            }

            await setJWT();
          }),
          matcher: (ctx: CookieHookMatcherContext) => {
            const { path } = ctx;

            if (
              path?.startsWith("/sign-in") ||
              path?.startsWith("/sign-up") ||
              path?.startsWith("/callback") ||
              path?.startsWith("/oauth2/callback") ||
              path?.startsWith("/email-otp/verify-email")
            ) {
              return true;
            }

            return false;
          },
        },
        {
          handler: createAuthMiddleware(async (ctx) => {
            const {
              context: { createAuthCookie },
              setCookie,
            } = ctx;

            const { attributes, name } = createAuthCookie(COOKIE_NAME, {
              maxAge: 0,
            });

            setCookie(name, "", attributes);
          }),
          matcher: (ctx: CookieHookMatcherContext) => {
            const {
              context: { session },
              path,
            } = ctx;

            if (
              path?.startsWith("/sign-out") ||
              path?.startsWith("/delete-user") ||
              (path?.startsWith("/get-session") && !session)
            ) {
              return true;
            }

            return false;
          },
        },
      ],
      before: [
        ...bearer.hooks.before,
        {
          handler: createAuthMiddleware(async (ctx) => {
            let {
              context: { adapter, internalAdapter },
              query,
            } = ctx;

            query = { ...query, disableRefresh: true };

            internalAdapter.deleteSession = async () => {};

            function noop<T>() {
              return async (): Promise<T> => {
                return 0 as T;
              };
            }

            adapter.create = noop();
            adapter.update = noop();
            adapter.delete = noop();
            adapter.deleteMany = noop();
            adapter.updateMany = noop();

            return { context: ctx };
          }),
          matcher: (ctx: HookMatcherContext) => {
            const {
              context: { adapter },
            } = ctx;

            const opts = adapter.options as ConvexAdapterOptions | undefined;

            return !opts?.isRunMutationCtx;
          },
        },
      ],
    },
    id: "convex",
    schema: {
      ...jwt.schema,
    },
  } satisfies BetterAuthPlugin;
}
