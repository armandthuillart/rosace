import { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { requireEnv } from "@repo/helpers";
import { Stripe } from "stripe";
import type { Id } from "./_generated/dataModel";
import type { JWKS } from "./crypto";
import { registerRoutes } from "./auth";
import { internal } from "./_generated/api";
import { clear, read } from "./cookies";

const http = new HttpRouter();

registerRoutes(http);

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
