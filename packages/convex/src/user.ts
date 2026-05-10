import { v } from "convex/values";
import { ConvexError } from "convex/values";

import { authQuery } from "./middleware";

export const getUser = authQuery
  .returns(
    v.object({
      email: v.string(),
      lastName: v.string(),
      firstName: v.string(),
    }),
  )
  .handler(async (ctx) => {
    const user = await ctx.db.get(ctx.userId);

    if (!user) {
      throw new ConvexError("User not found.");
    }

    return {
      email: user.email,
      lastName: user.lastName,
      firstName: user.firstName,
    };
  })
  .public();
