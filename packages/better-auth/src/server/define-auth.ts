import type { GenericDataModel, GenericSchema, SchemaDefinition } from "convex/server";

import type { AuthTriggers, BetterAuthOptionsWithoutDatabase } from "./types";

type GenericAuthDefinition<
  GenericCtx = unknown,
  DataModel extends GenericDataModel = GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true> = SchemaDefinition<GenericSchema, true>,
  AuthOptions extends BetterAuthOptionsWithoutDatabase = BetterAuthOptionsWithoutDatabase,
  MutationCtx = GenericCtx,
> = (ctx: GenericCtx) => AuthOptions & {
  triggers?: AuthTriggers<DataModel, Schema, MutationCtx>;
};

const defineAuth = <
  GenericCtx = unknown,
  DataModel extends GenericDataModel = GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true> = SchemaDefinition<GenericSchema, true>,
  AuthOptions extends BetterAuthOptionsWithoutDatabase = BetterAuthOptionsWithoutDatabase,
  MutationCtx = GenericCtx,
>(
  definition: GenericAuthDefinition<GenericCtx, DataModel, Schema, AuthOptions, MutationCtx>,
) => definition;

export { defineAuth };
