import { ConvexHttpClient } from "convex/browser";

declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_CONVEX_URL: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

function convexClient({ jwks }: { jwks: string }) {
  const address = import.meta.env.PUBLIC_CONVEX_URL!;
  const client = new ConvexHttpClient(address);

  if (jwks) {
    client.setAuth(jwks);
  }

  return client;
}

export { convexClient };
