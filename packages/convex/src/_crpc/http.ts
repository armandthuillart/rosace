// Template source owned by @repo/crpc.
// Edit this file to change generated output.

import { httpMiddleware as baseHttpMiddleware } from "../../../better-auth/src/server/polyfills";
import { getAuth } from "./auth";

function httpMiddleware() {
  return baseHttpMiddleware({ getAuth });
}

export { httpMiddleware };
