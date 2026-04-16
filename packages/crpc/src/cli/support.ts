import type { BetterAuthOptions } from "better-auth";
import type { GenericActionCtx, GenericDataModel } from "convex/server";

function authDefinition(_ctx: GenericActionCtx<GenericDataModel>): BetterAuthOptions {
  throw new Error(
    "Template stub only: generated authDefinition is resolved in the target Convex package.",
  );
}

export { authDefinition };
