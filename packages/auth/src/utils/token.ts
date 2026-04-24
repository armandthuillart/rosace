import { SignJWT, importJWK } from "jose";

import { requireEnv } from "./require-env";

type AuthJwks = {
  kid: string;
  privateJwk: JsonWebKey;
  publicJwks: { keys: JsonWebKey[] };
};

function randomToken(byteLength = 32) {
  const buffer = new Uint8Array(byteLength);

  crypto.getRandomValues(buffer);

  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

function loadAuthJwks(): AuthJwks {
  return JSON.parse(requireEnv("AUTH_JWKS")) as AuthJwks;
}

async function signAuthToken(userId: string) {
  const jwks = loadAuthJwks();
  const privateKey = await importJWK(jwks.privateJwk, "RS256");

  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: jwks.kid })
    .setSubject(userId)
    .setAudience("convex")
    .setIssuer(requireEnv("CONVEX_SITE_URL"))
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(privateKey);
}

function getPublicJwks() {
  return JSON.stringify(loadAuthJwks().publicJwks);
}

export { getPublicJwks, randomToken, signAuthToken };
