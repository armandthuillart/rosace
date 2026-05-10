import { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { requireEnv } from "@repo/utils";
import { Stripe } from "stripe";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { Id } from "./_generated/dataModel";
import type { JWKS } from "./crypto";

import { throttler } from "./throttler";
import { internal } from "./_generated/api";
import { clear, list, read } from "./cookies";
import { createPKCE, getAuthorizationURL } from "./oauth";

const http = new HttpRouter();

http.route({
  path: "/.well-known/openid-configuration",
  method: "GET",
  handler: httpAction(async () => {
    const issuer = requireEnv("CONVEX_SITE_URL");

    return new Response(
      JSON.stringify({
        authorization_endpoint: `${issuer}/oauth/authorize`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
        issuer,
      }),
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=60, stale-if-error=86400",
          "Content-Type": "application/json",
        },
        status: 200,
      },
    );
  }),
});

http.route({
  path: "/.well-known/jwks.json",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify((JSON.parse(requireEnv("JWKS")) as JWKS).public), {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=60, stale-if-error=86400",
        "Content-Type": "application/json",
      },
      status: 200,
    });
  }),
});

http.route({
  path: "/auth/session",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const token = read(request)["session:token"];

    if (!token) {
      return new Response("null", {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const session = await ctx.runQuery(internal.session.getSession, { token });

    if (!session) {
      const headers = new Headers({ "Content-Type": "application/json" });
      for (const cookie of [clear("session")]) headers.append("Set-Cookie", cookie);
      return new Response("null", { headers, status: 200 });
    }

    return new Response(JSON.stringify(session), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
      status: 200,
    });
  }),
});

http.route({
  pathPrefix: "/auth/login/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const provider = new URL(request.url).pathname.replace(/\/+$/, "").split("/").at(-1) as
      | "apple"
      | "google";

    if (!provider || !["apple", "google"].includes(provider)) {
      return new Response(null, { status: 400 });
    }

    let ipAddress: string | undefined;
    if (request.headers.get("cf-connecting-ip")) {
      ipAddress = request.headers.get("cf-connecting-ip")!.trim();
    } else if (request.headers.get("x-forwarded-for")) {
      ipAddress = request.headers.get("x-forwarded-for")!.split(",")[0].trim();
    }

    const { ok, retryAfter } = await throttler.limit(ctx, "login", {
      key: ipAddress,
    });

    if (!ok) {
      return new Response(null, {
        headers: { "X-Retry-After": String(Math.ceil((retryAfter! - Date.now()) / 1000)) },
        status: 429,
      });
    }
    const url = getAuthorizationURL(provider);

    const state = crypto.randomUUID().replace(/-/g, "");
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const { verifier, challenge, method } = await createPKCE();

    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);

    if (provider === "google") {
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", method);
    }

    await ctx.runMutation(internal.oauth.createAuthorizationSession, {
      expiresAt: Date.now() + 15 * 60_000,
      nonce,
      provider,
      state,
      verifier: provider === "google" ? verifier : undefined,
    });

    return new Response(null, {
      headers: { Location: url.toString() },
      status: 302,
    });
  }),
});

http.route({
  path: "/auth/logout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("origin");
    if (!origin) return new Response(null, { status: 403 });

    let requestOrigin: string;
    let trustedOrigin: string;
    try {
      trustedOrigin = new URL(requireEnv("DASHBOARD_URL")).origin;
      requestOrigin = new URL(origin).origin;
    } catch {
      return new Response(null, { status: 403 });
    }

    if (requestOrigin !== trustedOrigin) {
      return new Response(null, { status: 403 });
    }

    let ipAddress: string | undefined;
    if (request.headers.get("cf-connecting-ip")) {
      ipAddress = request.headers.get("cf-connecting-ip")!.trim();
    } else if (request.headers.get("x-forwarded-for")) {
      ipAddress = request.headers.get("x-forwarded-for")!.split(",")[0].trim();
    }

    const { ok, retryAfter } = await throttler.limit(ctx, "logout", {
      key: ipAddress,
    });

    if (!ok) {
      return new Response(null, {
        headers: { "X-Retry-After": String(Math.ceil((retryAfter! - Date.now()) / 1000)) },
        status: 429,
      });
    }

    const token = read(request)["session:token"];
    if (token) await ctx.runMutation(internal.session.deleteSession, { token });

    const headers = new Headers();
    headers.append("Set-Cookie", clear("session"));
    return new Response(null, { headers, status: 204 });
  }),
});

http.route({
  path: "/auth/handoff",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const handoff = read(request)["session:handoff"];

    if (!handoff) {
      const headers = new Headers();
      headers.append("Set-Cookie", clear("handoff"));
      return new Response(null, { headers, status: 400 });
    }

    const claimed = await ctx.runMutation(internal.oauth.consumeAuthorizationSession, {
      code: handoff,
    });

    if (!claimed) {
      const headers = new Headers();
      headers.append("Set-Cookie", clear("handoff"));
      return new Response(null, { headers, status: 400 });
    }

    const headers = new Headers({ Location: "/" });
    headers.append("Set-Cookie", clear("handoff"));
    for (const cookie of [list("session", claimed)]) headers.append("Set-Cookie", cookie);
    return new Response(null, { headers, status: 302 });
  }),
});

const callback = httpAction(async (ctx, request) => {
  const provider = new URL(request.url).pathname.replace(/\/+$/, "").split("/").at(-1) as
    | "apple"
    | "google";

  if (!provider || !["apple", "google"].includes(provider)) {
    return new Response(null, { status: 400 });
  }

  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  const contentType = request.headers.get("Content-Type") ?? "";

  let userForm: string | null = null;

  if (contentType.startsWith("application/x-www-form-urlencoded")) {
    const body = new URLSearchParams(await request.text());
    for (const [key, value] of body.entries()) params.set(key, value);
    userForm = params.get("user");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return new Response(null, { status: 400 });

  const consumed = await ctx.runMutation(internal.oauth.verifyAuthorizationSession, {
    state,
    provider,
  });

  if (!consumed) {
    return new Response(null, { status: 400 });
  }

  let profile: {
    accountId: string;
    email: string;
    firstName: string;
    lastName: string;
  } = {
    accountId: "",
    email: "",
    firstName: "",
    lastName: "",
  };
  try {
    const redirectURI = `${requireEnv("DASHBOARD_URL")}/auth/callback/${provider}`;

    if (provider === "google") {
      if (!consumed.verifier) return new Response(null, { status: 500 });

      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: requireEnv("GOOGLE_CLIENT_ID"),
          client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
          code,
          code_verifier: consumed.verifier,
          grant_type: "authorization_code",
          redirect_uri: redirectURI,
        }),
      });

      if (!response.ok) return new Response(null, { status: response.status });

      const tokens = (await response.json()) as { id_token: string | undefined };
      if (!tokens.id_token) return new Response(null, { status: 500 });

      const { payload } = (await jwtVerify(
        tokens.id_token,
        createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
        {
          audience: requireEnv("GOOGLE_CLIENT_ID"),
          issuer: ["https://accounts.google.com", "accounts.google.com"],
        },
      )) as {
        payload: {
          email: string;
          exp: number;
          email_verified: boolean | undefined;
          family_name: string | undefined;
          given_name: string | undefined;
          iss: string;
          nonce: string | undefined;
          sub: string;
        };
      };

      if (!payload.sub || !payload.nonce || payload.nonce !== consumed.nonce || !payload.email) {
        return new Response(null, { status: 500 });
      }

      profile = {
        accountId: payload.sub,
        email: payload.email.toLowerCase(),
        firstName: payload.given_name ?? "",
        lastName: payload.family_name ?? "",
      };
    }

    if (provider === "apple") {
      const response = await fetch("https://appleid.apple.com/auth/token", {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
        body: new URLSearchParams({
          client_id: requireEnv("APPLE_CLIENT_ID"),
          client_secret: requireEnv("APPLE_CLIENT_SECRET"),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectURI,
        }),
      });

      if (!response.ok) return new Response(null, { status: response.status });

      const tokens = (await response.json()) as { id_token: string | undefined };
      if (!tokens.id_token) return new Response(null, { status: 500 });

      const { payload } = (await jwtVerify(
        tokens.id_token,
        createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
        {
          audience: requireEnv("APPLE_CLIENT_ID"),
          issuer: "https://appleid.apple.com",
        },
      )) as {
        payload: {
          email: string | undefined;
          exp: number;
          email_verified: boolean | "true" | "false" | undefined;
          iss: string;
          nonce: string | undefined;
          sub: string;
        };
      };

      if (!payload.nonce || payload.nonce !== consumed.nonce || !payload.sub || !payload.email) {
        return new Response(null, { status: 400 });
      }

      let firstName = "";
      let lastName = "";

      if (userForm) {
        try {
          const parsed = JSON.parse(userForm) as {
            name: { firstName: string | undefined; lastName: string | undefined } | undefined;
          };
          lastName = parsed.name?.lastName ?? "";
          firstName = parsed.name?.firstName ?? "";
        } catch {}
      }

      profile = {
        accountId: payload.sub,
        email: payload.email.toLowerCase(),
        firstName,
        lastName,
      };
    }
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!profile.email) return new Response(null, { status: 400 });

  const { handoff } = await ctx.runMutation(internal.oauth.completeAuthorizationSession, {
    email: profile.email,
    lastName: profile.lastName,
    provider,
    accountId: profile.accountId,
    firstName: profile.firstName,
  });

  const headers = new Headers({ Location: `${requireEnv("DASHBOARD_URL")}/auth/handoff` });
  headers.append("Set-Cookie", list("handoff", { code: handoff }));
  return new Response(null, { headers, status: 302 });
});

http.route({
  pathPrefix: "/auth/callback/",
  method: "GET",
  handler: callback,
});

http.route({
  pathPrefix: "/auth/callback/",
  method: "POST",
  handler: callback,
});

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response(null, { status: 400 });

    const body = await request.text();

    const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        requireEnv("STRIPE_WEBHOOK_SECRET"),
      );
    } catch {
      return new Response(null, { status: 400 });
    }

    try {
      switch (event.type) {
        case "customer.created":
        case "customer.updated": {
          const customer = event.data.object as Stripe.Customer;

          await ctx.runMutation(internal.customer.handleCustomerCreatedOrUpdated, {
            customerId: customer.id,
            email: customer.email!,
            metadata: customer.metadata as { userId: Id<"users"> },
          });
          break;
        }

        case "customer.subscription.created": {
          const subscription = event.data.object as Stripe.Subscription;
          const item = subscription.items.data[0];

          const customerId =
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer.id;

          const productId =
            typeof item.price.product === "string" ? item.price.product : item.price.product.id;

          await ctx.runMutation(internal.subscription.handleSubscriptionCreated, {
            subscriptionId: subscription.id,
            customerId,
            status: subscription.status,
            currentPeriodEndsAt: item.current_period_end ?? 0,
            cancelsAtPeriodEnd: subscription.cancel_at_period_end ?? false,
            cancelsAt: subscription.cancel_at ?? undefined,
            productId,
            priceId: item.price.id,
            metadata: subscription.metadata as { userId: Id<"users"> },
          });

          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const _item = subscription.items.data[0];

          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const _item = subscription.items.data[0];

          break;
        }

        case "checkout.session.completed": {
          const _session = event.data.object as Stripe.Checkout.Session;

          break;
        }

        case "invoice.created":
        case "invoice.finalized": {
          const _invoice = event.data.object as Stripe.Invoice;

          break;
        }

        case "invoice.paid":
        case "invoice.payment_succeeded": {
          const _invoice = event.data.object as Stripe.Invoice;

          break;
        }

        case "invoice.payment_failed": {
          const _invoice = event.data.object as Stripe.Invoice;

          break;
        }

        case "payment_intent.succeeded": {
          const _paymentIntent = event.data.object as Stripe.PaymentIntent;

          break;
        }
      }
    } catch {
      return new Response(null, { status: 500 });
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
