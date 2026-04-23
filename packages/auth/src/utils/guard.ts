import { capitalize } from "./capitalize";

type Provider = "credentials" | "google" | "apple";

type Result = { blocked: Response; provider: null } | { blocked: null; provider: Provider };

function guard(request: Request, allowed: Provider[]): Result {
  const provider = new URL(request.url).pathname.replace(/\/+$/, "").split("/").at(-1);

  if (!provider) {
    return {
      provider: null,
      blocked: new Response("Pick a provider.", { status: 400 }),
    };
  }

  if (!allowed.includes(provider as Provider)) {
    return {
      provider: null,
      blocked: new Response(`${capitalize(provider)} is not supported.`, { status: 400 }),
    };
  }

  return {
    provider: provider as Provider,
    blocked: null,
  };
}

export { guard };
