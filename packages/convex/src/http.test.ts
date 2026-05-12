/// <reference types="vite-plus/client" />
import { convexTest } from 'convex-test';
import { jwtVerify } from 'jose';
import { Stripe } from 'stripe';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const DASHBOARD_URL = 'https://app.example.com';

function future(secondsFromNow: number) {
  return Date.now() + secondsFromNow * 1000;
}

vi.mock('./throttler', () => ({
  throttler: {
    limit: vi.fn().mockResolvedValue({ ok: true, retryAfter: undefined }),
  },
}));

vi.mock('jose', () => ({
  SignJWT: vi.fn(function () {
    return {
      setProtectedHeader: vi.fn().mockReturnThis(),
      setSubject: vi.fn().mockReturnThis(),
      setAudience: vi.fn().mockReturnThis(),
      setIssuer: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      sign: vi.fn().mockResolvedValue('mock-jwt-token'),
    };
  }),
  importJWK: vi.fn().mockResolvedValue('mock-private-key'),
  jwtVerify: vi.fn(),
  createRemoteJWKSet: vi.fn(),
}));

vi.mock('stripe', () => ({
  Stripe: vi.fn(),
}));

beforeAll(() => {
  vi.stubEnv('CONVEX_SITE_URL', 'https://test.convex.cloud');
  vi.stubEnv(
    'JWKS',
    JSON.stringify({
      kid: 'test-kid',
      public: { keys: [{ kty: 'RSA', n: 'test', e: 'AQAB' }] },
      private: { kty: 'RSA', n: 'test', e: 'AQAB' },
    }),
  );
  vi.stubEnv('DASHBOARD_URL', DASHBOARD_URL);
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret');
  vi.stubEnv('APPLE_CLIENT_ID', 'apple-client-id');
  vi.stubEnv('APPLE_CLIENT_SECRET', 'apple-client-secret');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_mock');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  vi.clearAllMocks();
  (vi.mocked(Stripe) as any).mockImplementation(function () {
    return {
      webhooks: { constructEventAsync: vi.fn() },
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_mock' }) },
    };
  });
  const { throttler: t } = await import('./throttler');
  (t.limit as any).mockResolvedValue({ ok: true, retryAfter: undefined });
});

describe('GET /.well-known/openid-configuration', () => {
  it('should return OpenID configuration with authorization_endpoint, jwks_uri, and issuer', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/.well-known/openid-configuration');

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.authorization_endpoint).toBe('https://test.convex.cloud/oauth/authorize');
    expect(body.jwks_uri).toBe('https://test.convex.cloud/.well-known/jwks.json');
    expect(body.issuer).toBe('https://test.convex.cloud');
  });

  it('should include public Cache-Control and JSON Content-Type headers', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/.well-known/openid-configuration');

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(response.headers.get('Cache-Control')).toContain('max-age=3600');
  });
});

describe('GET /.well-known/jwks.json', () => {
  it('should return the public JWKS parsed from the JWKS env var', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/.well-known/jwks.json');

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0].kty).toBe('RSA');
  });

  it('should include public Cache-Control and JSON Content-Type headers', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/.well-known/jwks.json');

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(response.headers.get('Cache-Control')).toContain('max-age=3600');
  });
});

describe('GET /auth/session', () => {
  it('should return session data with user for a valid token cookie', async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        plan: 'pro',
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert('sessions', {
        token: 'valid-token',
        userId,
        expiresAt: future(3600),
      });
    });

    const response = await t.fetch('/auth/session', {
      headers: { cookie: 'session:token=valid-token' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.firstName).toBe('Alice');
    expect(body.user.lastName).toBe('Smith');
    expect(body.user.plan).toBe('pro');
    expect(body.token).toBeTruthy();
  });

  it("should return 'null' when no session token cookie is present", async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/session');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('null');
  });

  it("should return 'null' and clear the session cookie when the token is invalid", async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/session', {
      headers: { cookie: 'session:token=invalid-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('null');
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toContain('session:token=');
    expect(setCookie).toContain('Max-Age=0');
  });
});

describe('GET /auth/login/:provider', () => {
  it('should redirect to the Google OAuth authorization endpoint with 302', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/login/google');

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location')!);
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.pathname).toBe('/o/oauth2/v2/auth');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('client_id')).toBe('google-client-id');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/auth/callback/google',
    );
    expect(location.searchParams.has('state')).toBe(true);
    expect(location.searchParams.has('nonce')).toBe(true);
    expect(location.searchParams.has('code_challenge')).toBe(true);
  });

  it('should redirect to the Apple OAuth authorization endpoint with 302', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/login/apple');

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location')!);
    expect(location.origin).toBe('https://appleid.apple.com');
    expect(location.pathname).toBe('/auth/authorize');
    expect(location.searchParams.get('response_type')).toBe('code id_token');
    expect(location.searchParams.get('client_id')).toBe('apple-client-id');
    expect(location.searchParams.get('scope')).toBe('name email');
    expect(location.searchParams.get('response_mode')).toBe('form_post');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/auth/callback/apple',
    );
    expect(location.searchParams.has('state')).toBe(true);
    expect(location.searchParams.has('nonce')).toBe(true);
    expect(location.searchParams.has('code_challenge')).toBe(false);
  });

  it('should return 400 for an unknown provider', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/login/github');

    expect(response.status).toBe(400);
  });

  it('should return 429 when rate limited', async () => {
    const t = convexTest({ schema, modules });
    const { throttler } = await import('./throttler');
    vi.mocked(throttler).limit.mockResolvedValue({
      ok: false,
      retryAfter: Date.now() + 60_000,
    });

    const response = await t.fetch('/auth/login/google');

    expect(response.status).toBe(429);
    expect(response.headers.has('X-Retry-After')).toBe(true);
  });
});

describe('POST /auth/logout', () => {
  it('should return 403 when the origin header is missing', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/logout', { method: 'POST' });

    expect(response.status).toBe(403);
  });

  it('should return 403 when the origin does not match DASHBOARD_URL', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/logout', {
      method: 'POST',
      headers: { origin: 'https://evil.com' },
    });

    expect(response.status).toBe(403);
  });

  it('should return 204 and clear the session cookie for a valid logout', async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Jones',
        plan: 'free',
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert('sessions', {
        token: 'logout-token',
        userId,
        expiresAt: future(3600),
      });
    });

    const response = await t.fetch('/auth/logout', {
      method: 'POST',
      headers: { origin: DASHBOARD_URL, cookie: 'session:token=logout-token' },
    });

    expect(response.status).toBe(204);
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toContain('session:token=');
    expect(setCookie).toContain('Max-Age=0');
    const session = await t.run(async (ctx) => {
      return await ctx.db
        .query('sessions')
        .withIndex('by_token', (q) => q.eq('token', 'logout-token'))
        .first();
    });
    expect(session).toBeNull();
  });

  it('should return 429 when rate limited', async () => {
    const t = convexTest({ schema, modules });
    const { throttler } = await import('./throttler');
    vi.mocked(throttler).limit.mockResolvedValue({
      ok: false,
      retryAfter: Date.now() + 60_000,
    });

    const response = await t.fetch('/auth/logout', {
      method: 'POST',
      headers: { origin: DASHBOARD_URL },
    });

    expect(response.status).toBe(429);
    expect(response.headers.has('X-Retry-After')).toBe(true);
  });
});

describe('GET /auth/handoff', () => {
  it('should return 400 when no handoff cookie is present', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/handoff');

    expect(response.status).toBe(400);
    expect(response.headers.get('Set-Cookie')).toContain('session:handoff=');
  });

  it('should return 302 with a session cookie when the handoff code is valid', async () => {
    const t = convexTest({ schema, modules });
    const handoffCode = 'valid-handoff-code';
    await t.run(async (ctx) => {
      await ctx.db.insert('verifications', {
        identifier: handoffCode,
        value: JSON.stringify({
          sessionToken: 'handoff-session-token',
          accessToken: 'handoff-access-token',
          expiresAt: future(3600),
        }),
        expiresAt: future(60),
      });
    });

    const response = await t.fetch('/auth/handoff', {
      headers: { cookie: `session:handoff=${handoffCode}` },
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/');
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toContain('session:handoff=');
  });

  it('should return 400 when the handoff code is invalid or already consumed', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/handoff', {
      headers: { cookie: 'session:handoff=non-existent-code' },
    });

    expect(response.status).toBe(400);
  });
});

describe('GET and POST /auth/callback/:provider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should return 400 when code or state params are missing', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/callback/google');

    expect(response.status).toBe(400);
  });

  it('should return 400 when the state does not match any authorization session', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/auth/callback/google?code=some-code&state=nonexistent-state');

    expect(response.status).toBe(400);
  });

  it('should complete Google OAuth flow via GET and redirect with handoff cookie', async () => {
    vi.useFakeTimers();
    const t = convexTest({ schema, modules });
    await t.run(async (ctx) => {
      await ctx.db.insert('verifications', {
        identifier: 'google-state',
        value: JSON.stringify({
          nonce: 'google-nonce',
          provider: 'google',
          verifier: 'google-verifier',
        }),
        expiresAt: future(3600),
      });
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id_token: 'mock-google-id-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    (vi.mocked(jwtVerify) as any).mockResolvedValue({
      payload: {
        sub: 'google-account-123',
        email: 'alice@example.com',
        nonce: 'google-nonce',
        given_name: 'Alice',
        family_name: 'Smith',
        email_verified: true,
        exp: future(3600) / 1000,
        iss: 'https://accounts.google.com',
      },
    });

    const response = await t.fetch('/auth/callback/google?code=test-code&state=google-state');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://app.example.com/auth/handoff');
    expect(response.headers.get('Set-Cookie')).toContain('session:handoff=');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );

    const account = await t.run(async (ctx) => {
      return await ctx.db
        .query('accounts')
        .withIndex('by_provider_account', (q) =>
          q.eq('provider', 'google').eq('accountId', 'google-account-123'),
        )
        .first();
    });
    expect(account).not.toBeNull();
    expect(account!.userId).toBeTruthy();

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', 'alice@example.com'))
        .first();
    });
    expect(user).not.toBeNull();
    expect(user!.firstName).toBe('Alice');
    expect(user!.lastName).toBe('Smith');
    expect(user!.plan).toBe('free');

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  });

  it('should complete Apple OAuth flow via POST form_post and redirect with handoff cookie', async () => {
    vi.useFakeTimers();
    const t = convexTest({ schema, modules });
    await t.run(async (ctx) => {
      await ctx.db.insert('verifications', {
        identifier: 'apple-state',
        value: JSON.stringify({
          nonce: 'apple-nonce',
          provider: 'apple',
        }),
        expiresAt: future(3600),
      });
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id_token: 'mock-apple-id-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    (vi.mocked(jwtVerify) as any).mockResolvedValue({
      payload: {
        sub: 'apple-account-456',
        email: 'bob@example.com',
        nonce: 'apple-nonce',
        email_verified: true,
        exp: future(3600) / 1000,
        iss: 'https://appleid.apple.com',
      },
    });

    const response = await t.fetch('/auth/callback/apple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: 'test-code',
        state: 'apple-state',
        user: JSON.stringify({ name: { firstName: 'Bob', lastName: 'Jones' } }),
      }).toString(),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://app.example.com/auth/handoff');
    expect(response.headers.get('Set-Cookie')).toContain('session:handoff=');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://appleid.apple.com/auth/token',
      expect.objectContaining({ method: 'POST' }),
    );

    const account = await t.run(async (ctx) => {
      return await ctx.db
        .query('accounts')
        .withIndex('by_provider_account', (q) =>
          q.eq('provider', 'apple').eq('accountId', 'apple-account-456'),
        )
        .first();
    });
    expect(account).not.toBeNull();

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', 'bob@example.com'))
        .first();
    });
    expect(user).not.toBeNull();
    expect(user!.firstName).toBe('Bob');
    expect(user!.lastName).toBe('Jones');
    expect(user!.plan).toBe('free');

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  });
});

describe('POST /stripe/webhook', () => {
  let stripeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stripeMock = vi.fn(function () {
      return {
        webhooks: { constructEventAsync: vi.fn() },
        customers: { create: vi.fn() },
      };
    });
    (vi.mocked(Stripe) as any).mockImplementation(stripeMock);
  });

  it('should return 400 when the stripe-signature header is missing', async () => {
    const t = convexTest({ schema, modules });

    const response = await t.fetch('/stripe/webhook', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(400);
  });

  it('should return 400 when constructEventAsync fails', async () => {
    const t = convexTest({ schema, modules });

    stripeMock.mockImplementation(function () {
      return {
        webhooks: {
          constructEventAsync: vi.fn().mockRejectedValue(new Error('bad sig')),
        },
        customers: { create: vi.fn() },
      };
    });

    const response = await t.fetch('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'bad-sig' },
      body: '{}',
    });

    expect(response.status).toBe(400);
  });

  it('should return 200 and handle customer.created event', async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        email: 'dave@example.com',
        firstName: 'Dave',
        lastName: 'Wilson',
        plan: 'free',
      });
    });

    stripeMock.mockImplementation(function () {
      return {
        webhooks: {
          constructEventAsync: vi.fn().mockResolvedValue({
            type: 'customer.created',
            data: {
              object: {
                id: 'cus_new123',
                email: 'dave@example.com',
                metadata: { userId },
              },
            },
          }),
        },
        customers: { create: vi.fn() },
      };
    });

    const response = await t.fetch('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify({ id: 'evt_1' }),
    });

    expect(response.status).toBe(200);
    const customer = await t.run(async (ctx) => {
      return await ctx.db
        .query('customers')
        .withIndex('by_customer', (q) => q.eq('customerId', 'cus_new123'))
        .unique();
    });
    expect(customer).not.toBeNull();
    expect(customer!.customerId).toBe('cus_new123');
    expect(customer!.email).toBe('dave@example.com');
    expect(customer!.userId).toBe(userId);
  });

  it('should return 200 and handle customer.subscription.created event', async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        email: 'eve@example.com',
        firstName: 'Eve',
        lastName: 'Adams',
        plan: 'pro',
      });
    });

    stripeMock.mockImplementation(function () {
      return {
        webhooks: {
          constructEventAsync: vi.fn().mockResolvedValue({
            type: 'customer.subscription.created',
            data: {
              object: {
                id: 'sub_new123',
                customer: 'cus_sub123',
                status: 'active',
                cancel_at_period_end: false,
                cancel_at: null,
                items: {
                  data: [
                    {
                      id: 'si_item123',
                      price: { id: 'price_mock', product: 'prod_mock' },
                      current_period_end: future(2592000),
                    },
                  ],
                },
                metadata: { userId },
              },
            },
          }),
        },
        customers: { create: vi.fn() },
      };
    });

    const response = await t.fetch('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify({ id: 'evt_2' }),
    });

    expect(response.status).toBe(200);
    const sub = await t.run(async (ctx) => {
      return await ctx.db
        .query('subscriptions')
        .withIndex('by_subscription', (q) => q.eq('subscriptionId', 'sub_new123'))
        .unique();
    });
    expect(sub).not.toBeNull();
    expect(sub!.subscriptionId).toBe('sub_new123');
    expect(sub!.status).toBe('active');
  });

  it('should return 200 for unhandled event types', async () => {
    const t = convexTest({ schema, modules });

    stripeMock.mockImplementation(function () {
      return {
        webhooks: {
          constructEventAsync: vi.fn().mockResolvedValue({
            type: 'invoice.paid',
            data: {
              object: { id: 'in_1', lines: { data: [] } },
            },
          }),
        },
        customers: { create: vi.fn() },
      };
    });

    const response = await t.fetch('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify({ id: 'evt_3' }),
    });

    expect(response.status).toBe(200);
  });

  it('should return 500 when the handler mutation throws', async () => {
    const t = convexTest({ schema, modules });

    stripeMock.mockImplementation(function () {
      return {
        webhooks: {
          constructEventAsync: vi.fn().mockResolvedValue({
            type: 'customer.created',
            data: {
              object: {
                id: 'cus_throw',
                email: 'fail@example.com',
                metadata: { userId: 'nonexistent' as Id<'users'> },
              },
            },
          }),
        },
        customers: { create: vi.fn() },
      };
    });

    const response = await t.fetch('/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify({ id: 'evt_4' }),
    });

    expect(response.status).toBe(500);
  });
});
