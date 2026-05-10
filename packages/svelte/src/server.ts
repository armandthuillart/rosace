// @ts-ignore
import { env } from "$env/dynamic/private";
import { redirect, type RequestEvent, type Handle } from "@sveltejs/kit";

import { convexClient } from "./client";
import type { Auth } from "./index";

const handle: Handle = async ({ event, resolve }) => {
  const target = env.CONVEX_SITE_URL;
  const source = new URL(event.request.url);

  if (source.pathname.startsWith("/auth/")) {
    const body =
      event.request.method === "GET" || event.request.method === "HEAD"
        ? undefined
        : await event.request.text();

    const upstream = await fetch(`${target}${source.pathname}${source.search}`, {
      method: event.request.method,
      headers: event.request.headers,
      body,
      redirect: "manual",
    });

    const headers = new Headers(upstream.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  }

  event.locals.auth = async (): Promise<Auth> => {
    const cookie = event.request.headers.get("cookie") ?? "";
    if (!cookie) return null;

    const response = await fetch(`${target}/auth/session`, {
      method: "GET",
      headers: { cookie },
    });

    if (!response.ok) return null;
    return (await response.json()) as Auth;
  };

  return resolve(event);
};

const logout = async (event: RequestEvent) => {
  const headers = new Headers();
  const origin = event.request.headers.get("origin");

  if (origin) {
    headers.set("origin", origin);
  }

  await event.fetch("/auth/logout", {
    method: "POST",
    headers,
  });

  redirect(303, "/");
};

function svelteAuth() {
  return { handle, logout };
}

export { svelteAuth, convexClient };
