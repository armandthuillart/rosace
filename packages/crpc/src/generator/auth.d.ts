import type { BetterAuthOptions } from "better-auth";
import type { GenericActionCtx, GenericDataModel } from "convex/server";

declare const authDefinition: (ctx: GenericActionCtx<GenericDataModel>) => BetterAuthOptions;

export default authDefinition;
