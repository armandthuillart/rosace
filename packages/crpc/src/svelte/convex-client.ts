import { ConvexHttpClient } from "convex/browser";

function convexClient({ convexURL, jwks }: { convexURL: string; jwks: string }) {
  const client = new ConvexHttpClient(convexURL);

  if (jwks) {
    client.setAuth(jwks);
  }

  return client;
}

export { convexClient };
