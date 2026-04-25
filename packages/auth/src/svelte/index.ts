// @ts-ignore
import { env } from "$env/dynamic/private";
import { fail, redirect, type RequestEvent, type Handle } from "@sveltejs/kit";

import { Auth } from "./types";

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

    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
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

const logout = async (event: RequestEvent) => {
  const headers = new Headers();
  const origin = event.request.headers.get("origin");

  if (origin) headers.set("origin", origin);

  await event.fetch("/auth/logout", {
    headers,
    method: "POST",
  });

  redirect(303, "/login");
};

const login = async (event: RequestEvent) => {
  const data = await event.request.formData();

  const email = String(data.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(data.get("password") ?? "");
  const lastName = String(data.get("lastName") ?? "").trim();
  const firstName = String(data.get("firstName") ?? "").trim();

  const register = Boolean(firstName || lastName);
  const missing = !email || !password || (register && (!firstName || !lastName));

  if (missing) {
    return fail(400, {
      email,
      missing: true,
      lastName,
      firstName,
    });
  }

  const headers = new Headers({ "content-type": "application/json" });
  const origin = event.request.headers.get("origin");
  if (origin) headers.set("origin", origin);

  const response = await event.fetch("/auth/login/credentials", {
    body: JSON.stringify({
      email,
      password,
      lastName: lastName || undefined,
      firstName: firstName || undefined,
    }),
    method: "POST",
    headers,
  });

  if (!response.ok) {
    return fail(400, {
      email,
      lastName,
      firstName,
      incorrect: true,
    });
  }

  redirect(303, "/");
};

export function svelteAuth() {
  return { handle, login, logout };
}
