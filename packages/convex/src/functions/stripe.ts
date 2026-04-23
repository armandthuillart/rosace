import Stripe from "stripe";

import { getEnv } from "../env";

const env = getEnv();

const _stripe = new Stripe(env.STRIPE_SECRET_KEY);
