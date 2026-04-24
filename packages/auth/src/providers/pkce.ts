import { toBase64Url } from "../utils/base64";

async function pkce(): Promise<{
  challenge: string;
  method: "S256";
  verifier: string;
}> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  const verifier = toBase64Url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = toBase64Url(new Uint8Array(digest));

  return { challenge, method: "S256", verifier };
}

export { pkce };
