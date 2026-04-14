import type { Jwk } from "better-auth/plugins";
import type { AuthProvider } from "convex/server";

interface ProviderOptions {
  baseURL: string;
  jwks?: string;
}

const toDataURI = (jwks: Jwk[]) =>
  `data:text/plain;charset=utf-8;base64,${btoa(JSON.stringify(mapJWKS(jwks)))}`;

const mapJWKS = (jwks: Jwk[]) => ({
  keys: jwks.map((key) => ({
    ...JSON.parse(key.publicKey),
    alg: "RS256",
    kid: key.id,
  })),
});

function betterAuth({ baseURL, jwks }: ProviderOptions) {
  let parsed = jwks ? JSON.parse(jwks) : undefined;

  if (parsed) {
    parsed = toDataURI(parsed);
  } else {
    parsed = `${baseURL}/api/auth/convex/token`;
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
