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

/**
 * Forwards every Convex HTTP request.
 *
 * @example
 * ```typescript
 * const app = new Hono();
 *
 * app.use(betterAuth({ baseURL: getEnv().DASHBOARD_URL }));
 *
 * export default new HttpRouter(app);
 * ```
 */
export class HttpRouter extends ConvexHttpRouter {
	/**
	 * Hono app.
	 * @internal
	 */
	private readonly _app: Hono;
	/**
	 * HTTP router handler.
	 * @internal
	 */
	private readonly _handler: ReturnType<typeof httpActionGeneric>;

	/**
	 * Creates a new HTTP router.
	 * @param app - Hono app, available as `c.env`.
	 */
	constructor(app: Hono) {
		super();
		this._app = app;
		this._handler = httpActionGeneric(
			async (ctx, request) => await app.fetch(request, ctx),
		);

		const parentGetRoutes = this.getRoutes.bind(this);
		const parentLookup = this.lookup.bind(this);

		/**
		 * Gets the routes in the HTTP router.
		 * @returns A list of route entries.
		 */
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

		/**
		 * Looks up a route in the HTTP router.
		 * @param path - The path to look up.
		 * @param method - The method to look up.
		 * @returns The route entry if found, otherwise null.
		 */
		this.lookup = (
			path: string,
			method: RoutableMethod | "HEAD",
		): LookupResult => {
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
