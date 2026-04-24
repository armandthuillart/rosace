import { requireEnv } from "./require-env";

async function hash(_type: "session", token: string): Promise<string> {
  const secret = requireEnv("AUTH_SECRET");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${token}:${secret}`),
  );

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { hash };
