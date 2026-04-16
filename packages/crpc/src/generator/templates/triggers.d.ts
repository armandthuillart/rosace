import type { GenericSchema, SchemaDefinition } from "convex/server";

import type { DataModel, GenericAuthTriggers, MutationCtx } from "./types";

export declare function defineTriggers<Schema extends SchemaDefinition<GenericSchema, true>>(
  schema: Schema,
  triggers: GenericAuthTriggers<DataModel, Schema, MutationCtx>,
): GenericAuthTriggers<DataModel, Schema, MutationCtx>;
