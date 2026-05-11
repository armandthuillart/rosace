import { requireEnv } from "@repo/utils";
import { mutation } from "./middleware";
import { randomToken, signJWT } from "./crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const AUTHORIZATION_ENDPOINTS: Record<"apple" | "google", string> = {
  apple: "https://appleid.apple.com/auth/authorize",
  google: "https://accounts.google.com/o/oauth2/v2/auth",
};

export function getAuthorizationURL(provider: "apple" | "google"): URL {
  const uri = `${requireEnv("DASHBOARD_URL")}/auth/callback/${provider}`;
  const url = new URL(AUTHORIZATION_ENDPOINTS[provider]);

  url.searchParams.set("redirect_uri", uri);

  if (provider === "google") {
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", requireEnv("GOOGLE_CLIENT_ID"));
    url.searchParams.set("scope", "openid email profile");
  } else {
    url.searchParams.set("response_type", "code id_token");
    url.searchParams.set("client_id", requireEnv("APPLE_CLIENT_ID"));
    url.searchParams.set("scope", "name email");
    url.searchParams.set("response_mode", "form_post");
  }

  return url;
}

export async function createPKCE(): Promise<{
  challenge: string;
  method: "S256";
  verifier: string;
}> {
  const toBase64Url = (bytes: Uint8Array) => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  const verifier = toBase64Url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = toBase64Url(new Uint8Array(digest));

  return { challenge, method: "S256", verifier };
}

export const createAuthorizationSession = mutation
  .input(
    v.object({
      state: v.string(),
      nonce: v.string(),
      provider: v.union(v.literal("apple"), v.literal("google")),
      verifier: v.optional(v.string()),
      expiresAt: v.number(),
    }),
  )
  .returns(v.null())
  .handler(async (ctx, args) => {
    await ctx.db.insert("verifications", {
      identifier: args.state,
      value: JSON.stringify({
        nonce: args.nonce,
        provider: args.provider,
        verifier: args.verifier,
      }),
      expiresAt: args.expiresAt,
    });

    return null;
  })
  .internal();

export const consumeAuthorizationSession = mutation
  .input(v.object({ code: v.string() }))
  .returns(
    v.union(
      v.null(),
      v.object({ sessionToken: v.string(), accessToken: v.string(), expiresAt: v.number() }),
    ),
  )
  .handler(async (ctx, args) => {
    const entry = await ctx.db
      .query("verifications")
      .withIndex("by_identifier", (q) => q.eq("identifier", args.code))
      .first();

    const expired = await ctx.db
      .query("verifications")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", Date.now()))
      .take(64);

    for (const row of expired) await ctx.db.delete(row._id);

    if (!entry || (entry && expired.some((row) => row._id === entry._id))) {
      return null;
    }

    await ctx.db.delete(entry._id);
    if (entry.expiresAt <= Date.now()) return null;

    try {
      return JSON.parse(entry.value) as {
        sessionToken: string;
        accessToken: string;
        expiresAt: number;
      };
    } catch {
      return null;
    }
  })
  .internal();

export const verifyAuthorizationSession = mutation
  .input(
    v.object({ provider: v.union(v.literal("apple"), v.literal("google")), state: v.string() }),
  )
  .returns(v.union(v.null(), v.object({ nonce: v.string(), verifier: v.optional(v.string()) })))
  .handler(async (ctx, args) => {
    const entry = await ctx.db
      .query("verifications")
      .withIndex("by_identifier", (q) => q.eq("identifier", args.state))
      .first();

    const expired = await ctx.db
      .query("verifications")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", Date.now()))
      .take(64);

    for (const row of expired) await ctx.db.delete(row._id);

    if (!entry || (entry && expired.some((row) => row._id === entry._id))) {
      return null;
    }

    await ctx.db.delete(entry._id);
    if (entry.expiresAt <= Date.now()) return null;

    let parsed: { provider: string; nonce: string; verifier: string | undefined };
    try {
      parsed = JSON.parse(entry.value);
    } catch {
      return null;
    }

    if (parsed.provider !== args.provider) return null;
    return { nonce: parsed.nonce, verifier: parsed.verifier };
  })
  .internal();

export const completeAuthorizationSession = mutation
  .input(
    v.object({
      provider: v.union(v.literal("apple"), v.literal("google")),
      accountId: v.string(),
      email: v.string(),
      firstName: v.string(),
      lastName: v.string(),
    }),
  )
  .returns(v.object({ handoff: v.string() }))
  .handler(async (ctx, args) => {
    const existingAccount = await ctx.db
      .query("accounts")
      .withIndex("by_provider_account", (q) => q.eq("provider", args.provider))
      .filter((q) => q.eq(q.field("accountId"), args.accountId))
      .first();

    let userId = existingAccount?.userId;

    if (!userId) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();

      if (!existingUser) {
        userId = await ctx.db.insert("users", {
          plan: "free",
          email: args.email,
          lastName: args.lastName,
          firstName: args.firstName,
        });
        await ctx.scheduler.runAfter(0, internal.customer.createCustomer, {
          name: `${args.firstName} ${args.lastName}`,
          email: args.email,
          userId,
        });
      } else {
        userId = existingUser._id;
      }

      await ctx.db.insert("accounts", {
        userId,
        provider: args.provider,
        accountId: args.accountId,
      });
    }

    await ctx.scheduler.runAfter(0, internal.customer.createCustomer, {
      name: `${args.firstName} ${args.lastName}`,
      email: args.email,
      userId,
    });

    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
    const sessionToken = randomToken();

    await ctx.db.insert("sessions", {
      token: sessionToken,
      userId,
      expiresAt,
    });

    const handoff = randomToken();

    await ctx.db.insert("verifications", {
      identifier: handoff,
      value: JSON.stringify({
        sessionToken,
        accessToken: await signJWT(userId),
        expiresAt,
      }),
      expiresAt: Date.now() + 60_000,
    });

    return { handoff };
  })
  .internal();
