import { randomBytes, randomUUID } from "node:crypto";

import { exportJWK, generateKeyPair } from "jose";

type SigningJwk = JsonWebKey & {
  kid: string;
  use: "sig";
  alg: "RS256";
};

type AuthJwksPayload = {
  kid: string;
  publicJwks: { keys: SigningJwk[] };
  privateJwk: SigningJwk;
};

type GeneratedAuthJwks = {
  kid: string;
  authJwks: string;
};

function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

function toSigningJwk(key: JsonWebKey, kid: string): SigningJwk {
  return {
    ...key,
    kid,
    use: "sig",
    alg: "RS256",
  };
}

async function generateAuthJwks(): Promise<GeneratedAuthJwks> {
  const kid = randomUUID();

  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);

  const payload: AuthJwksPayload = {
    kid,
    publicJwks: { keys: [toSigningJwk(publicJwk, kid)] },
    privateJwk: toSigningJwk(privateJwk, kid),
  };

  return {
    kid,
    authJwks: JSON.stringify(payload),
  };
}

export { generateSecret, generateAuthJwks };
export type { AuthJwksPayload, GeneratedAuthJwks, SigningJwk };
