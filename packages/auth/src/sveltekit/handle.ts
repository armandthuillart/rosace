import "./ambient";
import type { Handle } from "@sveltejs/kit";

import { requireEnv } from "../utils";
import type { Auth } from "./types";

const handle: Handle = async ({ event, resolve }) => {
  const SITE_URL = requireEnv("CONVEX_SITE_URL", event);

  const source = new URL(event.request.url);

  if (source.pathname.startsWith("/auth/")) {
    const body =
      event.request.method === "GET" || event.request.method === "HEAD"
        ? undefined
        : await event.request.text();

    const upstream = await fetch(`${SITE_URL}${source.pathname}${source.search}`, {
      method: event.request.method,
      headers: event.request.headers,
      body,
      redirect: "manual",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  }

  event.locals.auth = async (): Promise<Auth> => {
    const cookie = event.request.headers.get("cookie") ?? "";
    if (!cookie) return null;

    const response = await fetch(`${SITE_URL}/auth/session`, {
      headers: { cookie },
      method: "GET",
    });

    if (!response.ok) return null;
    return (await response.json()) as Auth;
  };

  return resolve(event);
};

export { handle };
