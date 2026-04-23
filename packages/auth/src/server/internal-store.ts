import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";

import { requireEnv } from "../utils";

const internalStore = internalMutationGeneric({
  args: v.object({
    args: v.union(
      v.object({
        type: v.literal("logout"),
        sessionToken: v.string(),
      }),
    ),
  }),
  handler: async (ctx, { args }) => {
    if (args.type !== "logout") {
      throw new Error(`Unsupported auth store op: ${args.type}`);
    }

    const secret = requireEnv("AUTH_SECRET");

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${args.sessionToken}:${secret}`),
    );

    const refreshTokenHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_refresh_token_hash", (q) => q.eq("refreshTokenHash", refreshTokenHash))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

export { internalStore };
