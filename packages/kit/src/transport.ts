import { FunctionReference } from "convex/server";

export async function convexLoad<Query extends FunctionReference<"query">>(
  ref: Query,
  args: FunctionArgs<Query>,
  options?: { token?: string },
): Promise<DetachedQueryResult<Query>> {
  if (typeof globalThis.document !== "undefined") {
    // Client-side navigation: use the authenticated singleton ConvexClient
    // for the initial fetch, then create a live subscription.
    const client = getConvexClient();
    const initialData = await client.query(ref, args);
    return createDetachedQuery(ref, args, initialData) as DetachedQueryResult<Query>;
  }

  // Server-side: HTTP fetch, wrap in ConvexLoadResult for transport.
  // transport.decode replaces this with a DetachedQueryResult on the client.
  const httpClient = new ConvexHttpClient(getConvexUrl());
  const token = options?.token ?? _getServerToken();
  if (token) {
    httpClient.setAuth(token);
  }
  const data = await httpClient.query(ref, args);
  const name = getFunctionName(ref);
  return new ConvexLoadResult(
    name,
    args as Record<string, unknown>,
    data,
  ) as unknown as DetachedQueryResult<Query>;
}
