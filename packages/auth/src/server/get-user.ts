import { Auth } from "convex/server";
import { GenericId } from "convex/values";

async function getUser(ctx: { auth: Auth }) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  return identity.subject as GenericId<"users">;
}

export { getUser };
