import { AsyncLocalStorage } from "node:async_hooks";

const localStorage = new AsyncLocalStorage<string | undefined>();

function setJWKS<T>(jwks: string | undefined, fn: () => T): T {
  return localStorage.run(jwks, fn);
}

function readJWKS(): string | undefined {
  return localStorage.getStore();
}

export { setJWKS, readJWKS };
