// Template source owned by @repo/crpc.
// Edit this file to change generated output.

import { httpMiddleware as baseHttpMiddleware } from "@repo/better-auth/http";

import { getAuth } from "./auth";

function httpMiddleware() {
  return baseHttpMiddleware({ getAuth });
}

export { httpMiddleware };
