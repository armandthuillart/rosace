import { Stripe } from "stripe";

import { getEnv } from "./env";

const stripe = new Stripe(getEnv().STRIPE_SECRET_KEY);
