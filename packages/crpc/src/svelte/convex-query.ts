import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from "convex/server";

import { createConvexClient } from "./convex-client";

async function convexQuery<Fn extends FunctionReference<"query">>(
  fn: Fn,
  { token }: { token: string },
  ...args: OptionalRestArgs<Fn>
): Promise<FunctionReturnType<Fn>> {
  const client = createConvexClient({ token });
  return client.query(fn, ...args);
}

export { convexQuery };
