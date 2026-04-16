import {
  HttpRouter as ConvexHttpRouter,
  httpActionGeneric,
  ROUTABLE_HTTP_METHODS,
  type RoutableMethod,
} from "convex/server";
import type { Hono } from "hono";

type Handler = ReturnType<typeof httpActionGeneric>;

type RouteEntry = readonly [string, RoutableMethod, Handler];

type LookupResult = readonly [Handler, RoutableMethod, string] | null;

export class HttpRouter extends ConvexHttpRouter {
  private readonly _app: Hono;
  private readonly _handler: ReturnType<typeof httpActionGeneric>;

  constructor(app: Hono) {
    super();
    this._app = app;
    this._handler = httpActionGeneric(async (ctx, request) => await app.fetch(request, ctx));

    const parentGetRoutes = this.getRoutes.bind(this);
    const parentLookup = this.lookup.bind(this);

    this.getRoutes = (): RouteEntry[] => {
      const parentRoutes = parentGetRoutes();
      const honoEntries: RouteEntry[] = [];

      for (const route of this._app.routes) {
        const method = route.method.toUpperCase() as RoutableMethod;

        if (ROUTABLE_HTTP_METHODS.includes(method)) {
          const method = route.method.toUpperCase() as RoutableMethod;

          if (ROUTABLE_HTTP_METHODS.includes(method)) {
            honoEntries.push([route.path, method, this._handler]);
          }
        }
      }

      return [...parentRoutes, ...honoEntries];
    };

    this.lookup = (path: string, method: RoutableMethod | "HEAD"): LookupResult => {
      const fromParent = parentLookup(path, method);

      if (fromParent !== null) {
        return fromParent;
      }

      const methodForHono = method === "HEAD" ? "GET" : method;

      const honoMatch = this._app.router.match(methodForHono, path);

      if (honoMatch[0].length > 0) {
        return [this._handler, methodForHono, path] as const;
      }

      return null;
    };
  }
}
