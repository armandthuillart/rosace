import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, createAuthMiddleware, sessionMiddleware } from "better-auth/api";
import {
  bearer as bearerPlugin,
  type Jwk,
  jwt as jwtPlugin,
  oidcProvider as oidcProviderPlugin,
} from "better-auth/plugins";
import { omit } from "convex-helpers";
import type { AuthConfig, AuthProvider } from "convex/server";

const JWT_COOKIE_NAME = "auth:jwt";
const JWT_EXPIRATION_SECONDS = 60 * 15;

type BetterAuthAfterHooks = NonNullable<NonNullable<BetterAuthPlugin["hooks"]>["after"]>;

type BetterAuthAfterHook = BetterAuthAfterHooks[number];

type BetterAuthHookContext = Parameters<BetterAuthAfterHook["matcher"]>[0];

const normalizeAfterHooks = <THook extends BetterAuthAfterHook>(
  hooks: THook[],
): BetterAuthAfterHooks =>
  hooks.map((hook) => ({
    ...hook,
    matcher: (ctx: BetterAuthHookContext) => Boolean(hook.matcher(ctx)),
  }));

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

  const oidcProvider = oidcProviderPlugin({
    loginPage: "/not-used",
    metadata: {
      issuer: baseURL,
      jwks_uri: `${baseURL}/api/auth/convex/jwk`,
    },
  });

  const jwt = jwtPlugin({
    adapter: {
      createJwk: async () => {
        throw new Error("Static JWKS only; set JWKS env and use env sync to rotate.");
      },
      getJwks: async () => {
        const normalize = (keys: Jwk[]) =>
          keys.map((k) => ({ ...k, createdAt: new Date(k.createdAt) }));
        const parsed = JSON.parse(jwks) as Jwk | Jwk[];
        return normalize(Array.isArray(parsed) ? parsed : [parsed]);
      },
    },
    jwks: {
      keyPairConfig: {
        alg: "RS256",
      },
    },
    jwt: {
      audience: "convex",
      definePayload: ({ user, session }) => ({
        ...omit(user, ["id", "image"]),
        iat: Math.floor(Date.now() / 1000),
        sessionId: session.id,
      }),
      expirationTime: `${JWT_EXPIRATION_SECONDS}s`,
      issuer: baseURL,
    },
  });

  const bearer = bearerPlugin();

  return {
    ...jwt,
    endpoints: {
      getJwk: createAuthEndpoint("/convex/jwk", { method: "GET" }, async (ctx) => {
        const response = await jwt.endpoints.getJwks({
          ...ctx,
          returnHeaders: false,
          returnStatus: false,
        });

        return response;
      }),
      getJwt: createAuthEndpoint(
        "/convex/jwt",
        {
          method: "GET",
          requireHeaders: true,
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const response = await jwt.endpoints.getToken({
            ...ctx,
            returnHeaders: false,
            returnStatus: false,
          });

          const jwtCookie = ctx.context.createAuthCookie(JWT_COOKIE_NAME, {
            maxAge: JWT_EXPIRATION_SECONDS,
          });

          ctx.setCookie(jwtCookie.name, response.token, jwtCookie.attributes);

          return { jwt: response.token };
        },
      ),
      getLatestJwks: createAuthEndpoint(
        "/convex/latest-jwks",
        {
          isAction: true,
          metadata: { SERVER_ONLY: true },
          method: "POST",
        },
        async (ctx) =>
          jwt.endpoints.getJwks({
            ...ctx,
            method: "GET",
            returnHeaders: false,
            returnStatus: false,
          }),
      ),
      getOpenIdConfig: createAuthEndpoint(
        "/convex/.well-known/openid-configuration",
        {
          metadata: {
            isAction: false,
          },
          method: "GET",
        },
        async (ctx) => {
          const response = await oidcProvider.endpoints.getOpenIdConfig({
            ...ctx,
            returnHeaders: false,
            returnStatus: false,
          });
          return response;
        },
      ),
      rotateKeys: createAuthEndpoint(
        "/convex/rotate-keys",
        {
          isAction: true,
          metadata: { SERVER_ONLY: true },
          method: "POST",
        },
        async (ctx) =>
          jwt.endpoints.getJwks({
            ...ctx,
            method: "GET",
            returnHeaders: false,
            returnStatus: false,
          }),
      ),
    },
    hooks: {
      after: [
        ...normalizeAfterHooks(oidcProvider.hooks.after),
        {
          handler: createAuthMiddleware(async (ctx) => {
            const originalSession = ctx.context.session;

            async function setJWT() {
              const { newSession } = ctx.context;
              ctx.context.session = originalSession ?? newSession;

              const { token } = await jwt.endpoints.getToken({
                ...ctx,
                headers: {},
                method: "GET",
                returnHeaders: false,
                returnStatus: false,
              });

              const jwtCookie = ctx.context.createAuthCookie(JWT_COOKIE_NAME, {
                maxAge: JWT_EXPIRATION_SECONDS,
              });

              ctx.setCookie(jwtCookie.name, token, jwtCookie.attributes);
            }

            try {
              await setJWT();
            } catch {
              // ignore
            }

            ctx.context.session = originalSession;
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
            const jwtCookie = ctx.context.createAuthCookie(JWT_COOKIE_NAME, {
              maxAge: 0,
            });

            ctx.setCookie(jwtCookie.name, "", jwtCookie.attributes);
          }),
          matcher: (ctx: CookieHookMatcherContext) => {
            const { path, context } = ctx;

            if (
              path?.startsWith("/sign-out") ||
              path?.startsWith("/delete-user") ||
              (path?.startsWith("/get-session") && !context.session)
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
            ctx.query = { ...ctx.query, disableRefresh: true };

            const { internalAdapter } = ctx.context;
            internalAdapter.deleteSession = async () => {};

            const knownSafePaths = ["/api-key/list", "/api-key/get"];

            function noop<T>(method: string) {
              return async (): Promise<T> => {
                if (ctx.path && !knownSafePaths.includes(ctx.path)) {
                  console.warn(
                    `Write operation "${method}" skipped in query context for ${ctx.path}.`,
                  );
                }
                return 0 as T;
              };
            }

            ctx.context.adapter.create = noop("create");
            ctx.context.adapter.update = noop("update");
            ctx.context.adapter.updateMany = noop("updateMany");
            ctx.context.adapter.delete = noop("delete");
            ctx.context.adapter.deleteMany = noop("deleteMany");

            return { context: ctx };
          }),
          matcher: (ctx: HookMatcherContext) => {
            const { context } = ctx;

            const opts = context.adapter.options as ConvexAdapterOptions | undefined;

            return !opts?.isRunMutationCtx;
          },
        },
      ],
    },
    id: "convex",
    schema: { ...jwt.schema },
  } satisfies BetterAuthPlugin;
}
