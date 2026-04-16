declare module "../auth" {
  const authDefinition: unknown;
  export default authDefinition;
}

declare module "./adapter" {
  export const createAdapter: unknown;
}

declare module "./auth" {
  export const defineAuth: unknown;
  export const getAuth: unknown;
  export const getAuthDefinition: unknown;
  export type Auth = unknown;
}

declare module "./http" {
  export const httpMiddleware: unknown;
}

declare module "./triggers" {
  export const defineTriggers: unknown;
}

declare module "./types" {
  export type ActionCtx = unknown;
  export type DataModel = unknown;
  export type GenericAuthDefinition = unknown;
  export type GenericAuthTriggers = unknown;
  export type MutationCtx = unknown;
}
