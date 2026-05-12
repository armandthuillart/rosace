import { requireEnv } from '@repo/utils';
import { v } from 'convex/values';
import { Stripe } from 'stripe';

import { internal } from './_generated/api';
import { action, mutation } from './middleware';

export const handleCustomerCreatedOrUpdated = mutation
  .input(
    v.object({
      customerId: v.string(),
      email: v.string(),
      metadata: v.object({ userId: v.id('users') }),
    }),
  )
  .returns(v.null())
  .handler(async (ctx, args) => {
    const existingCustomer = await ctx.db
      .query('customers')
      .withIndex('by_customer', (q) => q.eq('customerId', args.customerId))
      .unique();

    if (!existingCustomer) {
      await ctx.db.insert('customers', {
        customerId: args.customerId,
        userId: args.metadata.userId,
        email: args.email,
      });
    }

    if (existingCustomer) {
      await ctx.db.patch(existingCustomer._id, {
        email: args.email,
      });
    }

    return null;
  })
  .internal();

export const createOrUpdateCustomer = mutation
  .input(
    v.object({
      customerId: v.string(),
      email: v.string(),
      metadata: v.object({ userId: v.id('users') }),
    }),
  )
  .returns(v.string())
  .handler(async (ctx, args) => {
    const existingCustomer = await ctx.db
      .query('customers')
      .withIndex('by_customer', (q) => q.eq('customerId', args.customerId))
      .unique();

    if (!existingCustomer) {
      await ctx.db.insert('customers', {
        customerId: args.customerId,
        email: args.email,
        userId: args.metadata.userId,
      });
    } else {
      await ctx.db.patch(existingCustomer._id, {
        email: args.email,
        userId: args.metadata.userId,
      });
    }

    return args.customerId;
  })
  .internal();

export const createCustomer = action
  .input(
    v.object({
      name: v.string(),
      email: v.string(),
      userId: v.id('users'),
    }),
  )
  .returns(v.object({ customerId: v.string() }))
  .handler(async (ctx, args) => {
    const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));

    const customer = await stripe.customers.create(
      {
        name: args.name,
        email: args.email,
        metadata: { userId: args.userId },
      },
      { idempotencyKey: `create_customer_${args.userId}` },
    );

    await ctx.runMutation(internal.customer.createOrUpdateCustomer, {
      email: args.email,
      metadata: { userId: args.userId },
      customerId: customer.id,
    });

    return { customerId: customer.id };
  })
  .internal();
