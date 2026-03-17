import type { GenericAuthTriggers } from "@repo/better-auth/server";
import type {
	GenericDataModel,
	GenericMutationCtx,
	GenericSchema,
	SchemaDefinition,
} from "convex/server";

/**
 * Convex schema definition that has auth support turned on
 * and that you can attach auth triggers to.
 */
export type AuthSchema = SchemaDefinition<GenericSchema, true>;

/**
 * Convex mutation context that auth triggers run with.
 */
export type AuthCtx<DataModel extends GenericDataModel = GenericDataModel> =
	GenericMutationCtx<DataModel>;

/**
 * Shape of all auth triggers once they're wired up to your data model and schema.
 */
export type AuthTriggers<
	DataModel extends GenericDataModel = GenericDataModel,
	Schema extends AuthSchema = AuthSchema,
	Ctx = AuthCtx<DataModel>,
> = GenericAuthTriggers<DataModel, Schema, Ctx>;

/**
 * Tiny helper to run business logic on auth-related events.
 *
 * @param schema - The auth-enabled schema. Used for type inference only.
 * @param triggers - Your auth trigger implementations.
 * @returns The same trigger configuration you passed in.
 */
export function defineTriggers<
	DataModel extends GenericDataModel = GenericDataModel,
	Schema extends AuthSchema = AuthSchema,
	Ctx = AuthCtx<DataModel>,
>(_: Schema, triggers: AuthTriggers<DataModel, Schema, Ctx>) {
	return triggers;
}
