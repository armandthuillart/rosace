import "./ambient";
import type { Handle } from "@sveltejs/kit";

import type { Auth } from "./types";

function createHandle(convexSiteUrl: string): Handle {
  return async ({ event, resolve }) => {
    const source = new URL(event.request.url);

    if (source.pathname.startsWith("/auth/")) {
      const body =
        event.request.method === "GET" || event.request.method === "HEAD"
          ? undefined
          : await event.request.text();

      const upstream = await fetch(`${convexSiteUrl}${source.pathname}${source.search}`, {
        redirect: "manual",
        headers: event.request.headers,
        method: event.request.method,
        body,
      });

      return new Response(upstream.body, {
        headers: upstream.headers,
        status: upstream.status,
      });
    }

    event.locals.auth = async (): Promise<Auth> => {
      const cookie = event.request.headers.get("cookie") ?? "";
      if (!cookie) return null;

      const response = await fetch(`${convexSiteUrl}/auth/session`, {
        headers: { cookie },
        method: "GET",
      });

      if (!response.ok) return null;
      return (await response.json()) as Auth;
    };

    return resolve(event);
  };
}

export { createHandle };
