import { internalQueryGeneric } from "convex/server";
import { v } from "convex/values";

import { hash } from "../utils/hash";

const internalQuery = internalQueryGeneric({
  args: {
    payload: v.union(
      v.object({
        type: v.literal("session:get"),
        token: v.string(),
      }),
    ),
  },
  handler: async (ctx, { payload }) => {
    switch (payload.type) {
      case "session:get": {
        const refreshTokenHash = await hash("session", payload.token);

        const session = await ctx.db
          .query("sessions")
          .withIndex("by_refresh_token_hash", (q) => q.eq("refreshTokenHash", refreshTokenHash))
          .first();

        if (!session) return null;
        if (session.expiresAt <= Date.now()) return null;

        const user = await ctx.db.get(session.userId);
        if (!user) return null;

        return {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            plan: user.plan,
            verified: user.verified,
          },
        };
      }

      default: {
        const _never: never = payload.type;
        throw new Error(`Unsupported auth query op: ${String(_never)}`);
      }
    }
  },
});

export { internalQuery };
