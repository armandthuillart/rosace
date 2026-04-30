import type { Auth } from "convex/server";

import type { DataModel, Id } from "./_generated/dataModel";
import { createBuilder } from "./builder";
import { ConvexError } from "./errors";

export const convex = createBuilder<DataModel>();

export const authMiddleware = convex
  .$context<{
    auth: Auth;
  }>()
  .createMiddleware(async (ctx, next) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED" });
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
