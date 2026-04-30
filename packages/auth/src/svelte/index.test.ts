import type { Cookies, RequestEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { fail, redirect } = vi.hoisted(() => ({
  fail: vi.fn((status: number, data: unknown) => ({ status, data })),
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

vi.mock("@sveltejs/kit", async () => {
  const actual = await vi.importActual("@sveltejs/kit");
  return { ...actual, fail, redirect };
});

import { svelteAuth } from ".";

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
    vi.clearAllMocks();
  });

  it("proxies /auth/* requests to upstream", async () => {
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

  it("returns null from locals.auth when cookie is missing", async () => {
    const event = makeEvent({ url: "https://app.local/dashboard" });
    const resolve = vi.fn(async () => new Response("resolved"));

    const { handle } = svelteAuth();
    await handle({ event, resolve });

    const session = await event.locals.auth();
    expect(session).toBeNull();
  });

  it("returns session from locals.auth when upstream session is valid", async () => {
    const event = makeEvent({
      url: "https://app.local/dashboard",
      headers: { cookie: "session=abc" },
    });

    const resolve = vi.fn(async () => new Response("resolved"));

    const globalFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ userId: "u_1" }), { status: 200 }));

    const { handle } = svelteAuth();
    await handle({ event, resolve });

    const session = await event.locals.auth();

    expect(globalFetch).toHaveBeenCalledWith("https://convex.example/auth/session", {
      headers: { cookie: "session=abc" },
      method: "GET",
    });
    expect(session).toEqual({ userId: "u_1" });
  });

  it("fails closed when upstream session endpoint is unavailable", async () => {
    const event = makeEvent({
      url: "https://app.local/dashboard",
      headers: { cookie: "session=abc" },
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

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to / on successful login flow (omitted names)", async () => {
    const formData = new FormData();
    formData.set("email", "john@example.com");
    formData.set("password", "password123");

    const event = makeEvent({
      url: "https://app.local/login",
      method: "POST",
      headers: { origin: "https://app.local" },
      body: formData,
      fetchImpl: async () => new Response(null, { status: 200 }),
    });

    const { login } = svelteAuth();

    await expect(login(event)).rejects.toMatchObject({
      status: 303,
      location: "/",
    });

    const [, loginRequest] = vi.mocked(event.fetch).mock.calls[0] ?? [];
    if (!loginRequest) throw new Error("Expected login request");
    expect(loginRequest).toEqual(expect.objectContaining({ method: "POST" }));
    expect(loginRequest.headers).toBeInstanceOf(Headers);
    expect((loginRequest.headers as Headers).get("origin")).toBe("https://app.local");
    expect(typeof loginRequest.body).toBe("string");
    expect(JSON.parse(loginRequest.body as string)).toEqual({
      email: "john@example.com",
      password: "password123",
    });
    expect(redirect).toHaveBeenCalledWith(303, "/");
  });

  it("sends firstName and lastName for register flow", async () => {
    const formData = new FormData();
    formData.set("email", "john@example.com");
    formData.set("password", "password123");
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");

    const event = makeEvent({
      url: "https://app.local/login",
      method: "POST",
      headers: { origin: "https://app.local" },
      body: formData,
      fetchImpl: async () => new Response(null, { status: 200 }),
    });

    const { login } = svelteAuth();

    await expect(login(event)).rejects.toMatchObject({
      status: 303,
      location: "/",
    });

    const [, registerRequest] = vi.mocked(event.fetch).mock.calls[0] ?? [];
    if (!registerRequest) throw new Error("Expected register request");
    expect(registerRequest).toEqual(expect.objectContaining({ method: "POST" }));
    expect(registerRequest.headers).toBeInstanceOf(Headers);
    expect((registerRequest.headers as Headers).get("origin")).toBe("https://app.local");
    expect(typeof registerRequest.body).toBe("string");
    expect(JSON.parse(registerRequest.body as string)).toEqual({
      email: "john@example.com",
      password: "password123",
      firstName: "John",
      lastName: "Doe",
    });
    expect(redirect).toHaveBeenCalledWith(303, "/");
  });

  it("returns fail(400) when register flow is missing one name", async () => {
    const formData = new FormData();
    formData.set("email", "john@example.com");
    formData.set("password", "password123");
    formData.set("firstName", "John");

    const event = makeEvent({
      url: "https://app.local/login",
      method: "POST",
      headers: { origin: "https://app.local" },
      body: formData,
      fetchImpl: async () => new Response(null, { status: 200 }),
    });

    const { login } = svelteAuth();
    const result = await login(event);

    expect(event.fetch).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        email: "john@example.com",
        firstName: "John",
        lastName: null,
        missing: true,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ status: 400 }));
  });
});

describe("logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts to /auth/logout and redirects to /login", async () => {
    const event = makeEvent({
      url: "https://app.local/logout",
      headers: { origin: "https://app.local" },
      fetchImpl: async () => new Response(null, { status: 204 }),
    });

    const { logout } = svelteAuth();

    await expect(logout(event)).rejects.toMatchObject({
      status: 303,
      location: "/login",
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
    expect(redirect).toHaveBeenCalledWith(303, "/login");
  });
});
