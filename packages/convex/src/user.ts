import { ServerError } from "@repo/crpc";
import { v } from "convex/values";

import { authQuery } from "./crpc";

export const getUser = authQuery
  .returns(
    v.object({
      email: v.string(),
      name: v.string(),
    }),
  )
  .handler(async (ctx) => {
    const user = await ctx.db.get(ctx.userId);

    if (!user) {
      throw new ServerError({ code: "INTERNAL_SERVER_ERROR" });
    }

    return {
      email: user.email,
      name: user.name,
    };
  })
  .public();
