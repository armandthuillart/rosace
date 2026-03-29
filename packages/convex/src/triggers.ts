import { defineTriggers } from "./crpc/auth";
import schema from "./schema";

export default defineTriggers(schema, {
  users: {
    create: {
      after: async (_user, _ctx) => {
        // Create a new customer.
      },
    },
  },
});
