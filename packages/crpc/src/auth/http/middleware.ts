import type { Context, MiddlewareHandler, Next } from "hono";
import { cors } from "hono/cors";

import { tryCatch } from "../../utils/try-catch";

export interface MiddlewareOptions {
  /**
   * The CORS origin for OpenID redirect.
   * @required
   */
  baseURL: string;
  /**
   * Auth getter from context.
   * @required
   */
  getAuth: (ctx: unknown) => {
    handler: (request: Request) => Promise<Response>;
  };
}

/**
 * Middleware for CORS.
 *
 * @param options - Base URL.
 * @returns A Hono middleware handler.
 */
function betterAuth({ baseURL, getAuth }: MiddlewareOptions): MiddlewareHandler {
  const corsHandler = cors({
    allowHeaders: ["Content-Type", "Authorization", "Better-Auth-Cookie"],
    credentials: true,
    exposeHeaders: ["Set-Better-Auth-Cookie"],
    origin: baseURL,
  });

  /**
   * Middleware for CORS.
   * @param c - The context.
   * @param next - The next middleware.
   * @returns The response.
   */
  return async (c: Context, next: Next) => {
    let response: Response | undefined;

    await corsHandler(c, async () => {
      if (c.req.path === "/.well-known/openid-configuration") {
        response = c.redirect(`${baseURL}/api/auth/convex/.well-known/openid-configuration`);
        return;
      }

      if (c.req.path.startsWith("/api/auth")) {
        const auth = getAuth(c.env);

        const { data, error } = await tryCatch(auth.handler(c.req.raw));

        if (error) {
          response = normalize(error);
        }

        if (data) {
          response = data;
        }

        return;
      }

      await next();
    });

    return response;
  };
}

type Object = Record<string, unknown>;
type Headers = Record<string, string>;

/**
 * Normalizes an error to a response.
 * @param error - The error to normalize.
 * @returns The response.
 */
function normalize(error: unknown): Response {
  const o = error as Object | null;

  if (o && isObject(o) && "statusCode" in o && isNumber(o.statusCode)) {
    const status = isNumber(o.statusCode) ? o.statusCode : 500;
    const headers = new Headers((o.headers as Headers) ?? {});

    const init: ResponseInit = {
      headers,
      status,
      ...(isString(o.status) && { statusText: o.status }),
    };

    if (o.body === undefined) {
      return new Response(null, init);
    }

    if (isString(o.body) && !headers.has("content-type")) {
      headers.set("content-type", "text/plain");
      return new Response(o.body, init);
    }

    return Response.json(o.body, init);
  }

  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status: 500 });
}

/**
 * Checks if a value is an object.
 * @param value - The value to check.
 * @returns True if the value is an object, false otherwise.
 */
function isObject(value: unknown): value is Object {
  return typeof value === "object" && value !== null;
}

/**
 * Checks if a value is a number.
 * @param value - The value to check.
 * @returns True if the value is a number, false otherwise.
 */
function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

/**
 * Checks if a value is a string.
 * @param value - The value to check.
 * @returns True if the value is a string, false otherwise.
 */
function isString(value: unknown): value is string {
  return typeof value === "string";
}

export { betterAuth };
