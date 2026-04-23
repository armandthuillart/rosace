import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";

import { requireEnv } from "../utils";

export const logout = internalMutationGeneric({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, { sessionToken }) => {
    const secret = requireEnv("AUTH_SECRET");

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${sessionToken}:${secret}`),
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
