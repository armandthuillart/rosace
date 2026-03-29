import { AsyncLocalStorage } from "node:async_hooks";

const tokenStorage = new AsyncLocalStorage<string | undefined>();
