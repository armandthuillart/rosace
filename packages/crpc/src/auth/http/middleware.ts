import type { Context, MiddlewareHandler, Next } from "hono";
import { cors } from "hono/cors";

import { isObject, isNumber, isString, tryCatch } from "../../utils/try-catch";

export interface MiddlewareOptions {
  baseURL: string;
  getAuth: (ctx: unknown) => {
    handler: (request: Request) => Promise<Response>;
  };
}

function betterAuth({ baseURL, getAuth }: MiddlewareOptions): MiddlewareHandler {
  const corsHandler = cors({
    allowHeaders: ["Content-Type", "Authorization", "Better-Auth-Cookie"],
    credentials: true,
    exposeHeaders: ["Set-Better-Auth-Cookie"],
    origin: baseURL,
  });

  return async (c: Context, next: Next) => {
    let response: Response | undefined;

    await corsHandler(c, async () => {
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

function normalize(error: unknown): Response {
  const obj = error as Object | null;

  if (obj && isObject(obj) && "statusCode" in obj && isNumber(obj.statusCode)) {
    const status = isNumber(obj.statusCode) ? obj.statusCode : 500;
    const headers = new Headers((obj.headers as Headers) ?? {});

    const init: ResponseInit = {
      headers,
      status,
      ...(isString(obj.status) && { statusText: obj.status }),
    };

    if (obj.body === undefined) {
      return new Response(null, init);
    }

    if (isString(obj.body) && !headers.has("content-type")) {
      headers.set("content-type", "text/plain");
      return new Response(obj.body, init);
    }

    return Response.json(obj.body, init);
  }

  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status: 500 });
}

export { betterAuth };
