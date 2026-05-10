import { Id } from "./_generated/dataModel";
import { SignJWT, importJWK, type JWK } from "jose";
import { requireEnv } from "@repo/helpers";

export type JWKS = {
  kid: string;
  public: { keys: JWK[] };
  private: JWK;
};

export async function signJWT(userId: Id<"users">) {
  const jwks = JSON.parse(requireEnv("JWKS")) as JWKS;
  const jwk = await importJWK(jwks.private, "RS256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: jwks.kid })
    .setSubject(userId)
    .setAudience("convex")
    .setIssuer(requireEnv("CONVEX_SITE_URL"))
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(jwk);
}
