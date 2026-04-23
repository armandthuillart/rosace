import type { Auth } from "convex/server";
import { ConvexError } from "convex/values";

import type { DataModel, Id } from "../_generated/dataModel";
import { createBuilder } from "./create-builder";

export const convex = createBuilder<DataModel>();

export const authMiddleware = convex
  .$context<{
    auth: Auth;
  }>()
  .createMiddleware(async (ctx, next) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError("You must be logged in to access this resource.");
    }

    const userId = identity.subject as Id<"users">;

    return next({
      ...ctx,
      userId,
    });
  });

export const authQuery = convex.query().use(authMiddleware);
export const authAction = convex.action().use(authMiddleware);
export const authMutation = convex.mutation().use(authMiddleware);
