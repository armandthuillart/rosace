import { requireEnv } from "./require-env";

function csrf(req: Request): Response | null {
  if (req.method !== "POST") return null;

  const origin = req.headers.get("origin");
  if (!origin) return new Response(null, { status: 403 });

  const trustedOrigin = new URL(requireEnv("DASHBOARD_URL")).origin;
  const requestOrigin = new URL(origin).origin;

  if (requestOrigin !== trustedOrigin) {
    return new Response(null, { status: 403 });
  }

  return null;
}

export { csrf };
