import { defineTriggers } from "./crpc/auth";
import schema from "./schema";

export default defineTriggers(schema, {
  users: {
    create: {
      after: async () => {
        // Create a new customer in Stripe.
      },
    },
    delete: {
      after: async () => {
        // Delete the customer from Stripe.
      },
    },
    update: {
      after: async () => {
        // Update the customer email in Stripe.
      },
    },
  },
});
