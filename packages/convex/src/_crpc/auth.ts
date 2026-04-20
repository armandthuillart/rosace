// Template source owned by @repo/crpc.
// Edit this file to change generated output.

import { betterAuth, BetterAuthOptions } from "better-auth";
import type { GenericSchema, SchemaDefinition } from "convex/server";

import { defineAuth as baseDefineAuth } from "../../../better-auth/src/server";
import authDefinition from "../auth";
import { createAdapter } from "./adapter";
import type { ActionCtx, DataModel, GenericAuthDefinition, MutationCtx } from "./types";

function defineAuth<AuthOptions extends BetterAuthOptions = BetterAuthOptions>(
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
> {
  return baseDefineAuth<
    ActionCtx,
    DataModel,
    SchemaDefinition<GenericSchema, true>,
    AuthOptions,
    MutationCtx
  >(definition);
}

function getAuthDefinition(ctx: ActionCtx<DataModel>) {
  const authOptions = authDefinition(ctx);
  return betterAuth({
    ...authOptions,
    database: createAdapter(ctx),
  });
}

type Auth = ReturnType<typeof getAuthDefinition>;

function getAuth(ctx: unknown) {
  const auth = getAuthDefinition(ctx as ActionCtx<DataModel>);
  return { handler: auth.handler.bind(auth) };
}

export { defineAuth, getAuthDefinition, getAuth };
export type { Auth };
