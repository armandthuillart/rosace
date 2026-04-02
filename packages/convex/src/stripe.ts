import { Stripe } from "stripe";

import { getEnv } from "./env";

const _stripe = new Stripe(getEnv().STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});
