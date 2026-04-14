import { AsyncLocalStorage } from "node:async_hooks";

const tokenStorage = new AsyncLocalStorage<string | undefined>();

function setToken<T>(token: string | undefined, fn: () => T): T {
  return tokenStorage.run(token, fn);
}

function readToken(): string | undefined {
  return tokenStorage.getStore();
}

export { setToken, readToken };
