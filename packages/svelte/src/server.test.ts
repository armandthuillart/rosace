import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((status: number, location: string) => {
    throw Object.assign(new Error('Redirect'), { status, location });
  }),
}));

vi.mock('$env/dynamic/private', () => ({
  env: { CONVEX_SITE_URL: 'https://convex.example' },
}));

vi.mock('$env/dynamic/public', () => ({
  env: { PUBLIC_CONVEX_URL: 'https://convex.example' },
}));

vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('@sveltejs/kit', async () => {
  const actual = await vi.importActual('@sveltejs/kit');
  return { ...actual, redirect };
});

import { svelteAuth } from './server';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeEvent(input: {
  url: string;
  method?: string;
  headers?: Headers | Record<string, string>;
  body?: FormData | string | null;
  fetchImpl?: (input: Request | URL | string, init?: RequestInit) => Promise<Response>;
}): any {
  const cookies = {
    get: vi.fn(),
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
    serialize: vi.fn((name, value) => `${name}=${value}`),
  };

  const request = new Request(input.url, {
    method: input.method ?? 'GET',
    headers: input.headers,
    body: input.body,
  });

  return {
    request,
    url: new URL(request.url),
    params: {},
    route: { id: null },
    locals: { auth: async () => null },
    platform: undefined,
    fetch: vi.fn(input.fetchImpl),
    cookies,
    setHeaders: vi.fn(),
    getClientAddress: () => '127.0.0.1',
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

describe('handle', () => {
  it('should proxy /auth/* requests to upstream', async () => {
    const upstream = new Response('ok', { status: 201 });
    const globalFetch = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal('fetch', globalFetch);
    const event = makeEvent({
      url: 'https://app.local/auth/login?next=%2Fdashboard',
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'payload',
    });
    const resolve = vi.fn(async () => new Response('resolved'));
    const { handle } = svelteAuth();

    const response = await handle({ event, resolve });

    expect(globalFetch).toHaveBeenCalledWith(
      'https://convex.example/auth/login?next=%2Fdashboard',
      expect.objectContaining({
        method: 'POST',
        body: 'payload',
        redirect: 'manual',
      }),
    );
    expect(resolve).not.toHaveBeenCalled();
    expect(response.status).toBe(201);
  });

  it('should return null from locals.auth when cookie is missing', async () => {
    const event = makeEvent({ url: 'https://app.local/dashboard' });
    const resolve = vi.fn(async () => new Response('resolved'));
    const { handle } = svelteAuth();

    await handle({ event, resolve });
    const session = await event.locals.auth();

    expect(session).toBeNull();
  });

  it('should return session from locals.auth when upstream session is valid', async () => {
    const event = makeEvent({
      url: 'https://app.local/dashboard',
      headers: { cookie: 'session:token=abc' },
    });
    const resolve = vi.fn(async () => new Response('resolved'));
    const globalFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ userId: 'u_1' }), { status: 200 }));
    vi.stubGlobal('fetch', globalFetch);
    const { handle } = svelteAuth();

    await handle({ event, resolve });
    const session = await event.locals.auth();

    expect(globalFetch).toHaveBeenCalledWith('https://convex.example/auth/session', {
      headers: { cookie: 'session:token=abc' },
      method: 'GET',
    });
    expect(session).toEqual({ userId: 'u_1' });
  });

  it('should fail closed when upstream session endpoint is unavailable', async () => {
    const event = makeEvent({
      url: 'https://app.local/dashboard',
      headers: { cookie: 'session:token=abc' },
    });
    const resolve = vi.fn(async () => new Response('resolved'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('upstream failure', { status: 503 })),
    );
    const { handle } = svelteAuth();

    await handle({ event, resolve });
    const session = await event.locals.auth();

    expect(session).toBeNull();
  });
});

describe('logout', () => {
  it('should post to /auth/logout and redirect to /', async () => {
    const event = makeEvent({
      url: 'https://app.local/logout',
      headers: { origin: 'https://app.local' },
      fetchImpl: async () => new Response(null, { status: 204 }),
    });
    const { logout } = svelteAuth();

    const promise = logout(event);

    await expect(promise).rejects.toMatchObject({ status: 303, location: '/' });
    expect(event.fetch).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      headers: expect.any(Headers),
    });
    expect(redirect).toHaveBeenCalledWith(303, '/');
  });
});
