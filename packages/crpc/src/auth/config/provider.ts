import type { AuthProvider } from "convex/server";

import { toJwkDataUri } from "./algorithm";

interface ProviderOptions {
  /**
   * The base URL for the application.
   * @required
   */
  baseURL: string;
  /**
   * The JWK JSON string. If set, token verification uses it instead of fetching.
   * @optional
   */
  jwks?: string;
}

/**
 * @param options - baseURL and JWK.
 * @returns Convex AuthProvider for custom JWT (RS256).
 */
function betterAuth({ baseURL, jwks }: ProviderOptions) {
  let parsed = jwks ? JSON.parse(jwks) : undefined;

  if (parsed) {
    parsed = toJwkDataUri(parsed);
  } else {
    parsed = `${baseURL}/api/auth/convex/jwks`;
  }

  const provider: AuthProvider = {
    algorithm: "RS256",
    applicationID: "convex",
    issuer: baseURL,
    jwks: parsed,
    type: "customJwt",
  };

  return provider;
}

export { betterAuth };
