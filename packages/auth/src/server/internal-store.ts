import { internalMutation } from "./internal-mutation";
import { internalQuery } from "./internal-query";

const internalStore = {
  mutation: internalMutation,
  query: internalQuery,
};

export { internalStore };
