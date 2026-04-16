import { env } from "$env/dynamic/public";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from "convex/server";

const getQueryClient = ({ token }: { token: string }) => {
  const client = new ConvexHttpClient(env.PUBLIC_CONVEX_URL);
  if (token) client.setAuth(token);
  return client;
};

const convexQuery = async <Fn extends FunctionReference<"query">>(
  fn: Fn,
  opts: { token: string },
  ...args: OptionalRestArgs<Fn>
): Promise<FunctionReturnType<Fn>> => {
  const client = getQueryClient(opts);
  return client.query(fn, ...args);
};

export { convexQuery };
