import { v } from "convex/values";

import { ConvexError } from "../procedures/errors";
import { authQuery } from "./rpc";

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
      throw new ConvexError({ code: "INTERNAL_SERVER_ERROR" });
    }

    return {
      email: user.email,
      lastName: user.lastName,
      firstName: user.firstName,
    };
  })
  .public();
