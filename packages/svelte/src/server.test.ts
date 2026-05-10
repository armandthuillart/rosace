import type { Cookies, RequestEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((status: number, location: string) => {
    throw Object.assign(new Error("Redirect"), { status, location });
  }),
}));

vi.mock("$env/dynamic/private", () => ({
  env: { CONVEX_SITE_URL: "https://convex.example" },
}));

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_CONVEX_URL: "https://convex.example" },
}));

vi.mock("$app/environment", () => ({ browser: true }));

vi.mock("@sveltejs/kit", async () => {
  const actual = await vi.importActual("@sveltejs/kit");
  return { ...actual, redirect };
});

import { svelteAuth } from "./server";

function makeEvent(input: {
  url: string;
  method?: string;
  headers?: Headers | Record<string, string>;
  body?: FormData | string | null;
  fetchImpl?: (input: Request | URL | string, init?: RequestInit) => Promise<Response>;
}): RequestEvent {
  const cookies: Cookies = {
    get: vi.fn(),
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
    serialize: vi.fn((name, value) => `${name}=${value}`),
  };

  const request = new Request(input.url, {
    method: input.method ?? "GET",
    headers: input.headers,
    body: input.body,
  });

  return {
    request,
    url: new URL(request.url),
    params: {},
    route: { id: null },
    locals: {
      auth: async () => null,
    },
    platform: undefined,
    fetch: vi.fn(input.fetchImpl),
    cookies,
    setHeaders: vi.fn(),
    getClientAddress: () => "127.0.0.1",
    isDataRequest: false,
    isSubRequest: false,
    tracing: {
      enabled: false,
      root: undefined as unknown as never,
      current: undefined as unknown as never,
    },
    isRemoteRequest: false,
  };
}

describe("handle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should proxy /auth/* requests to upstream", async () => {
    const upstream = new Response("ok", {
      status: 201,
      headers: { "x-proxy": "1" },
    });

    const globalFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream);

    const event = makeEvent({
      url: "https://app.local/auth/login?next=%2Fdashboard",
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "payload",
    });

    const resolve = vi.fn(async () => new Response("resolved"));
    const { handle } = svelteAuth();

    const response = await handle({ event, resolve });

    expect(globalFetch).toHaveBeenCalledWith(
      "https://convex.example/auth/login?next=%2Fdashboard",
      expect.objectContaining({
        method: "POST",
        body: "payload",
        redirect: "manual",
      }),
    );

    expect(resolve).not.toHaveBeenCalled();
    expect(response.status).toBe(201);
    expect(response.headers.get("x-proxy")).toBe("1");
  });

  it("should return null from locals.auth when cookie is missing", async () => {
    const event = makeEvent({ url: "https://app.local/dashboard" });
    const resolve = vi.fn(async () => new Response("resolved"));

    const { handle } = svelteAuth();
    await handle({ event, resolve });

    const session = await event.locals.auth();
    expect(session).toBeNull();
  });

  it("should return session from locals.auth when upstream session is valid", async () => {
    const event = makeEvent({
      url: "https://app.local/dashboard",
      headers: { cookie: "session:token=abc" },
    });

    const resolve = vi.fn(async () => new Response("resolved"));

    const globalFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ userId: "u_1" }), { status: 200 }));

    const { handle } = svelteAuth();
    await handle({ event, resolve });

    const session = await event.locals.auth();

    expect(globalFetch).toHaveBeenCalledWith("https://convex.example/auth/session", {
      headers: { cookie: "session:token=abc" },
      method: "GET",
    });
    expect(session).toEqual({ userId: "u_1" });
  });

  it("should fail closed when upstream session endpoint is unavailable", async () => {
    const event = makeEvent({
      url: "https://app.local/dashboard",
      headers: { cookie: "session:token=abc" },
    });
    const resolve = vi.fn(async () => new Response("resolved"));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("upstream failure", { status: 503 }),
    );

    const { handle } = svelteAuth();
    await handle({ event, resolve });

    const session = await event.locals.auth();
    expect(session).toBeNull();
  });
});

describe("logout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should post to /auth/logout and redirect to /login", async () => {
    const event = makeEvent({
      url: "https://app.local/logout",
      headers: { origin: "https://app.local" },
      fetchImpl: async () => new Response(null, { status: 204 }),
    });

    const { logout } = svelteAuth();

    await expect(logout(event)).rejects.toMatchObject({
      status: 303,
      location: "/",
    });

    expect(event.fetch).toHaveBeenCalledWith(
      "/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
    const [, logoutRequest] = vi.mocked(event.fetch).mock.calls[0] ?? [];
    if (!logoutRequest) throw new Error("Expected logout request");
    expect(logoutRequest.headers).toBeInstanceOf(Headers);
    expect((logoutRequest.headers as Headers).get("origin")).toBe("https://app.local");
    expect(redirect).toHaveBeenCalledWith(303, "/");
  });
});
