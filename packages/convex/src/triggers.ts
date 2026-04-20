import { defineTriggers } from "./_crpc";
import schema from "./schema";

export default defineTriggers(schema, {
  users: {
    create: {
      after: async () => {},
    },
    delete: {
      after: async () => {},
    },
    update: {
      after: async () => {},
    },
  },
});
