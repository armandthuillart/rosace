import { ConvexHttpClient } from "convex/browser";

function convexClient({ baseURL, jwks }: { baseURL: string; jwks?: string }) {
  const client = new ConvexHttpClient(baseURL);

  if (jwks) {
    client.setAuth(jwks);
  }

  return client;
}

export { convexClient };
