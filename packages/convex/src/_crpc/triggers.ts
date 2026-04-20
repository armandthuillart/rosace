// Template source owned by @repo/crpc.
// Edit this file to change generated output.

import { SchemaDefinition } from "convex/server";
import { GenericSchema } from "convex/server";

import { defineTriggers as baseDefineTriggers } from "../../../better-auth/src/server";
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
