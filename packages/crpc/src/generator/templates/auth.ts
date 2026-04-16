import { defineAuth, getAuth, getAuthDefinition } from "./auth.template";

type Auth = ReturnType<typeof getAuthDefinition>;

export { defineAuth, getAuth, getAuthDefinition };
export type { Auth };
