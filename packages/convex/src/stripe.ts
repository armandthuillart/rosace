import { Stripe } from "stripe";

import { getEnv } from "./env";

const env = getEnv();

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
