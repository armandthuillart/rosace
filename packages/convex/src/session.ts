import { query } from "./middleware";
import { v } from "convex/values";
import { signJWT } from "./crypto";

export const getSession = query
  .input(v.object({ token: v.string() }))
  .returns(
    v.optional(
      v.union(
        v.object({
          expiresAt: v.number(),
          token: v.string(),
          user: v.object({
            _creationTime: v.number(),
            _id: v.id("users"),
            email: v.string(),
            firstName: v.string(),
            lastName: v.string(),
            plan: v.union(v.literal("free"), v.literal("pro")),
          }),
        }),
        v.null(),
      ),
    ),
  )
  .handler(async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt <= Date.now()) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    return {
      user,
      token: await signJWT(user._id),
      expiresAt: session.expiresAt,
    };
  })
  .internal();
