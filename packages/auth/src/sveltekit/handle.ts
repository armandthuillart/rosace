import { Handle } from "@sveltejs/kit";

import { requireEnv } from "../utils";
import { Auth } from "./types";

const handle: Handle = async ({ event, resolve }) => {
  const target = requireEnv("CONVEX_SITE_URL");
  const source = new URL(event.request.url);

  if (source.pathname.startsWith("/auth/")) {
    const body =
      event.request.method === "GET" || event.request.method === "HEAD"
        ? undefined
        : await event.request.text();

    const upstream = await fetch(`${target}${source.pathname}${source.search}`, {
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

    const response = await fetch(`${target}/auth/session`, {
      headers: { cookie },
      method: "GET",
    });

    if (!response.ok) return null;
    return (await response.json()) as Auth;
  };

  return resolve(event);
};

export { handle };
