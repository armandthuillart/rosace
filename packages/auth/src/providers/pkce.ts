import { createHash, randomBytes } from "node:crypto";

function base64url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pkce(): {
  method: "S256";
  verifier: string;
  challenge: string;
} {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());

  return {
    method: "S256",
    verifier,
    challenge,
  };
}

export { pkce };
