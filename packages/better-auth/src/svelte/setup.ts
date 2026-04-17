import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from "convex/server";

import { convexQuery } from "../convex";
import { requestHandler } from "./handler";

function setupServer({ address }: { address: string }) {
  return {
    handler: () => requestHandler(address),
    convexQuery: async <Query extends FunctionReference<"query">>(
      query: Query,
      opts: { token: string },
      ...args: OptionalRestArgs<Query>
    ): Promise<FunctionReturnType<Query>> => convexQuery(query, opts, ...args),
  };
}

export { setupServer };
