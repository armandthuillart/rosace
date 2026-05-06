// @ts-ignore
import { env } from "$env/dynamic/private";
import { fail, redirect, type RequestEvent, type Handle } from "@sveltejs/kit";
import * as v from "valibot";

import { convexClient } from "./client";
import type { Session } from "./index.types";

const LoginFormSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
  lastName: v.nullish(v.string()),
  firstName: v.nullish(v.string()),
});

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

  event.locals.auth = async (): Promise<Session> => {
    const cookie = event.request.headers.get("cookie") ?? "";
    if (!cookie) return null;

    const response = await fetch(`${target}/auth/session`, {
      headers: { cookie },
      method: "GET",
    });

    if (!response.ok) return null;
    return (await response.json()) as Session;
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
  const formData = await event.request.formData();

  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
    lastName: formData.get("lastName"),
    firstName: formData.get("firstName"),
  };

  const { email, password, lastName, firstName } = v.parse(LoginFormSchema, rawData);

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

function svelteAuth() {
  return { handle, login, logout };
}

export { svelteAuth, convexClient };
