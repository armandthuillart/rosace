import posthog from "posthog-js";
import { env } from "$env/dynamic/public";
import type { HandleClientError } from "@sveltejs/kit";

export async function init() {
  if (!env.PUBLIC_POSTHOG_API_KEY) {
    return;
  }

  posthog.init(env.PUBLIC_POSTHOG_API_KEY, {
    api_host: "/ingest",
    ui_host: env.PUBLIC_POSTHOG_HOST,
    capture_exceptions: true,
    defaults: "2025-05-24",
  });
}

export const handleError: HandleClientError = async ({ error, status, message }) => {
  posthog.captureException(error);

  posthog.capture("dashboard_client_error", {
    message,
    status,
    error:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown client error",
  });

  return {
    kind: "client_error",
    message,
    timestamp: new Date().toISOString(),
  };
};
