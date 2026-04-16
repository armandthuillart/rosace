import type { BetterAuthOptions } from "better-auth";
import type { GenericActionCtx, GenericDataModel } from "convex/server";

export default function authDefinition(
  _ctx: GenericActionCtx<GenericDataModel>,
): BetterAuthOptions {
  throw new Error("Template source helper only.");
}
