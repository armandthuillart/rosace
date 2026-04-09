import type { GenericAuthTriggers } from "@repo/better-auth/server";
import type {
  GenericDataModel,
  GenericMutationCtx,
  GenericSchema,
  SchemaDefinition,
} from "convex/server";

type AuthSchema = SchemaDefinition<GenericSchema, true>;

type AuthCtx<DataModel extends GenericDataModel = GenericDataModel> = GenericMutationCtx<DataModel>;

type AuthTriggers<
  DataModel extends GenericDataModel = GenericDataModel,
  Schema extends AuthSchema = AuthSchema,
  Ctx = AuthCtx<DataModel>,
> = GenericAuthTriggers<DataModel, Schema, Ctx>;

export function defineTriggers<
  DataModel extends GenericDataModel = GenericDataModel,
  Schema extends AuthSchema = AuthSchema,
  Ctx = AuthCtx<DataModel>,
>(_: Schema, triggers: AuthTriggers<DataModel, Schema, Ctx>) {
  return triggers;
}
