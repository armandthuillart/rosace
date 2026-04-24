import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";

import { hash } from "../utils/hash";

const internalMutation = internalMutationGeneric({
  args: v.union(
    v.object({
      type: v.literal("session:delete"),
      token: v.string(),
    }),
    v.object({
      type: v.literal("oauth:start"),
      provider: v.union(v.literal("google"), v.literal("apple")),
      state: v.string(),
      nonce: v.string(),
      verifier: v.optional(v.string()),
      expiresAt: v.number(),
    }),
    v.object({
      type: v.literal("oauth:consume"),
      provider: v.union(v.literal("google"), v.literal("apple")),
      state: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    switch (args.type) {
      case "session:delete": {
        const refreshTokenHash = await hash("session", args.token);

        const session = await ctx.db
          .query("sessions")
          .withIndex("by_refresh_token_hash", (q) => q.eq("refreshTokenHash", refreshTokenHash))
          .first();

        if (session) {
          await ctx.db.delete(session._id);
        }

        return { ok: true };
      }

      case "oauth:start": {
        // TODO: persist state/nonce/verifier/provider/expiresAt in dedicated table
        // For now, keep explicit unsupported to avoid silent no-op.
        throw new Error("oauth:start is not implemented yet");
      }

      case "oauth:consume": {
        // TODO: atomically load + invalidate oauth start entry by (provider, state)
        throw new Error("oauth:consume is not implemented yet");
      }

      default:
        throw new Error("Unsupported mutation operation.");
    }
  },
});

export { internalMutation };
