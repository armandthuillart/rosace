import type { GenericDataModel } from "convex/server";

import type { AuthTriggers, AuthSchema, AuthCtx } from "./types";

function defineTriggers<
  DataModel extends GenericDataModel = GenericDataModel,
  Schema extends AuthSchema = AuthSchema,
  Ctx = AuthCtx<DataModel>,
>(_: Schema, triggers: AuthTriggers<DataModel, Schema, Ctx>) {
  return triggers;
}

export { defineTriggers };
