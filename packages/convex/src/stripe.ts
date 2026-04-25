import Stripe from "stripe";

import { env } from "./env";

const _stripe = new Stripe(env.STRIPE_SECRET_KEY);
