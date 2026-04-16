import type { BetterAuthOptions } from "better-auth";
import type { GenericSchema, SchemaDefinition } from "convex/server";

import type { ActionCtx, DataModel, GenericAuthDefinition, MutationCtx } from "./types";

export declare function defineAuth<AuthOptions extends BetterAuthOptions = BetterAuthOptions>(
  definition: GenericAuthDefinition<
    ActionCtx,
    DataModel,
    SchemaDefinition<GenericSchema, true>,
    AuthOptions,
    MutationCtx
  >,
): GenericAuthDefinition<
  ActionCtx,
  DataModel,
  SchemaDefinition<GenericSchema, true>,
  AuthOptions,
  MutationCtx
>;

export declare function getAuthDefinition(ctx: ActionCtx<DataModel>): {
  handler: (request: Request) => Promise<Response>;
};

export declare function getAuth(ctx: unknown): { handler: (request: Request) => Promise<Response> };

export type Auth = ReturnType<typeof getAuthDefinition>;
