import type { Auth } from "convex/server";
import { ConvexError } from "convex/values";

import type { DataModel, Id } from "./_generated/dataModel";
import { createBuilder } from "./builder";

export const convex = createBuilder<DataModel>();

export const authMiddleware = convex
  .$context<{ auth: Auth }>()
  .createMiddleware(async (ctx, next) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Sign in to continue.");

    return next({ ...ctx, userId: identity.subject as Id<"users"> });
  });

export const query = convex.query();
export const action = convex.action();
export const mutation = convex.mutation();

export const authQuery = convex.query().use(authMiddleware);
export const authAction = convex.action().use(authMiddleware);
export const authMutation = convex.mutation().use(authMiddleware);
