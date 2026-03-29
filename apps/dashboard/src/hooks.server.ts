import type { Handle, HandleServerError } from "@sveltejs/kit";
import { getPostHog } from "$lib/server/posthog";

const INGEST_PREFIX = "/ingest";

export const handle: Handle = async ({ event, resolve }) => {
  if (!event.url.pathname.startsWith(INGEST_PREFIX)) {
    return resolve(event);
  }

  const isStaticAsset = event.url.pathname.startsWith("/ingest/static/");
  const host = isStaticAsset ? "us-assets.i.posthog.com" : "us.i.posthog.com";
  const url = new URL(event.request.url);
  url.protocol = "https:";
  url.hostname = host;
  url.port = "443";
  url.pathname = event.url.pathname.replace(/^\/ingest/, "");

  const headers = new Headers(event.request.headers);
  headers.set("host", host);
  headers.set("accept-encoding", "");

  const clientIp = event.request.headers.get("x-forwarded-for") || event.getClientAddress();
  if (clientIp) {
    headers.set("x-forwarded-for", clientIp);
  }

  return fetch(url.toString(), {
    method: event.request.method,
    headers,
    body: event.request.body,
    // @ts-expect-error Required for streaming request bodies
    duplex: "half",
  });
};

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  try {
    const posthog = getPostHog();

    posthog.capture({
      distinctId: "server",
      event: "dashboard_server_error",
      properties: {
        status,
        message,
        method: event.request.method,
        path: event.url.pathname,
        error:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown server error",
      },
    });
  } catch {
    // Swallow capture failures so error handling never breaks request processing.
  }

  return {
    kind: "server_error",
    message,
    timestamp: new Date().toISOString(),
  };
};
