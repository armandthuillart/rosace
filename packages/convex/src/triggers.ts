import { defineTriggers } from "./_crpc";
import schema from "./schema";

export default defineTriggers(schema, {
  users: {
    create: {
      after: async () => {
        // TODO: Create a new customer in Stripe.
      },
    },
    delete: {
      after: async () => {
        // TODO: Delete the customer from Stripe.
      },
    },
    update: {
      after: async () => {
        // TODO: Update the customer email in Stripe.
      },
    },
  },
});
