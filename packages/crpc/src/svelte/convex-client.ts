import { env } from "$env/dynamic/public";
import { ConvexHttpClient } from "convex/browser";

function createConvexClient({ token }: { token: string }) {
  const convexURL = env.PUBLIC_CONVEX_URL;

  if (!convexURL) {
    throw new Error("Missing PUBLIC_CONVEX_URL");
  }

  const client = new ConvexHttpClient(convexURL);

  if (token) {
    client.setAuth(token);
  }

  return client;
}

export { createConvexClient };
