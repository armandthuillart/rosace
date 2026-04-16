// Template source owned by @repo/crpc.
// Edit this file to change generated output.

import { defineTriggers as baseDefineTriggers } from "@repo/better-auth/server";
import { SchemaDefinition } from "convex/server";
import { GenericSchema } from "convex/server";

import { GenericAuthTriggers } from "./types";
import { DataModel } from "./types";
import { MutationCtx } from "./types";

function defineTriggers<Schema extends SchemaDefinition<GenericSchema, true>>(
  schema: Schema,
  triggers: GenericAuthTriggers<DataModel, Schema, MutationCtx>,
): GenericAuthTriggers<DataModel, Schema, MutationCtx> {
  return baseDefineTriggers<DataModel, Schema, MutationCtx>(schema, triggers);
}

export { defineTriggers };
