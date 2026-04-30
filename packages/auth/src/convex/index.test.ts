import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type Route = {
  path?: string;
  pathPrefix?: string;
  method: string;
  handler: (ctx: TestCtx, request: Request) => Promise<Response>;
};

type TestCtx = {
  runAction: ReturnType<typeof vi.fn>;
  runMutation: ReturnType<typeof vi.fn>;
  runQuery: ReturnType<typeof vi.fn>;
};

const {
  createPkceMock,
  exchangeCodeMock,
  getAuthorizationUrlMock,
  httpActionGenericMock,
  limitMock,
  requireEnvMock,
} = vi.hoisted(() => ({
  createPkceMock: vi.fn(async () => ({
    challenge: "pkce-challenge",
    method: "S256",
    verifier: "pkce-verifier",
  })),
  exchangeCodeMock: vi.fn(),
  getAuthorizationUrlMock: vi.fn(() => new URL("https://accounts.google.com/o/oauth2/v2/auth")),
  httpActionGenericMock: vi.fn((handler: unknown) => handler),
  limitMock: vi.fn(async () => ({ ok: true, retryAfter: Date.now() + 1_000 })),
  requireEnvMock: vi.fn((key: string) => {
    const env: Record<string, string> = {
      CONVEX_SITE_URL: "https://convex.example",
      DASHBOARD_URL: "https://dashboard.example",
    };
    const value = env[key];
    if (!value) throw new Error(`Missing env: ${key}`);
    return value;
  }),
}));

vi.mock("convex/server", async () => {
  const actual = await vi.importActual<typeof import("convex/server")>("convex/server");
  return {
    ...actual,
    httpActionGeneric: httpActionGenericMock,
  };
});

vi.mock("@repo/helpers", () => ({ requireEnv: requireEnvMock }));
vi.mock("@repo/convex/rate-limiter", () => ({ rateLimiter: { limit: limitMock } }));
vi.mock("../providers", () => ({
  createPkce: createPkceMock,
  exchangeCode: exchangeCodeMock,
  getAuthorizationUrl: getAuthorizationUrlMock,
}));
vi.mock("./store", () => ({
  authStore: {
    query: "auth:query",
    mutation: "auth:mutation",
    action: "auth:action",
  },
  getPublicJwks: () => JSON.stringify({ keys: [] }),
}));

import { convexAuth } from "./index";

function createCtx(): TestCtx {
  return {
    runAction: vi.fn(),
    runMutation: vi.fn(),
    runQuery: vi.fn(),
  };
}

function setupRoutes() {
  const routes: Route[] = [];
  const http = {
    route: (definition: Route) => {
      routes.push(definition);
    },
  };
  convexAuth().registerRoutes(http as never);

  return {
    handler(method: string, pathOrPrefix: string) {
      const match = routes.find(
        (route) =>
          route.method === method &&
          (route.path === pathOrPrefix || route.pathPrefix === pathOrPrefix),
      );
      if (!match) {
        throw new Error(`Route not found: ${method} ${pathOrPrefix}`);
      }
      return match.handler;
    },
  };
}

describe("convex auth routes security/regression", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("session boundaries and revocation isolation", () => {
    it("guarantees session lookup fails closed and clears stale cookie", async () => {
      const routes = setupRoutes();
      const ctx = createCtx();
      ctx.runQuery.mockResolvedValue(null);

      const response = await routes.handler("GET", "/auth/session")(
        ctx,
        new Request("https://convex.example/auth/session", {
          headers: { cookie: "session:refresh=deadbeef" },
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe("null");
      expect(response.headers.get("set-cookie")).toContain("session:refresh=;");
      expect(ctx.runQuery).toHaveBeenCalledWith("auth:query", {
        payload: { type: "session:get", token: "deadbeef" },
      });
    });

    it("guarantees logout revokes only presented session token and ignores missing cookie", async () => {
      const routes = setupRoutes();
      const ctx = createCtx();
      ctx.runMutation.mockResolvedValue(null);

      const withoutCookie = await routes.handler("POST", "/auth/logout")(
        ctx,
        new Request("https://convex.example/auth/logout", {
          method: "POST",
          headers: { origin: "https://dashboard.example" },
        }),
      );

      const withCookie = await routes.handler("POST", "/auth/logout")(
        ctx,
        new Request("https://convex.example/auth/logout", {
          method: "POST",
          headers: {
            cookie: "session:refresh=victim-token",
            origin: "https://dashboard.example",
          },
        }),
      );

      expect(withoutCookie.status).toBe(204);
      expect(withCookie.status).toBe(204);
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledWith("auth:mutation", {
        payload: { type: "session:revoke", token: "victim-token" },
      });
    });
  });

  describe("oauth callback tampering and account-link hijack resistance", () => {
    it("guarantees callback rejects tampered requests missing state or code", async () => {
      const routes = setupRoutes();
      const ctx = createCtx();

      const response = await routes.handler("GET", "/auth/callback/")(
        ctx,
        new Request("https://convex.example/auth/callback/google?state=only-state"),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toBe("Missing code or state.");
      expect(ctx.runMutation).not.toHaveBeenCalled();
      expect(exchangeCodeMock).not.toHaveBeenCalled();
    });

    it("guarantees account linking fails closed when oauth state is expired, replayed, or forged", async () => {
      const routes = setupRoutes();
      const ctx = createCtx();
      ctx.runMutation.mockResolvedValueOnce(null);

      const response = await routes.handler("GET", "/auth/callback/")(
        ctx,
        new Request("https://convex.example/auth/callback/google?code=auth-code&state=bad-state"),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toBe("Invalid or expired state.");
      expect(ctx.runMutation).toHaveBeenCalledWith("auth:mutation", {
        payload: { type: "oauth:authorize:consume-state", provider: "google", state: "bad-state" },
      });
      expect(exchangeCodeMock).not.toHaveBeenCalled();
    });
  });

  describe("one-time handoff token guarantees", () => {
    it("guarantees handoff claim is one-time and replay attempts fail closed", async () => {
      const routes = setupRoutes();
      const ctx = createCtx();
      ctx.runMutation
        .mockResolvedValueOnce({
          accessToken: "access-1",
          expiresAt: 1_000_000,
          sessionToken: "session-1",
        })
        .mockResolvedValueOnce(null);

      const first = await routes.handler("GET", "/auth/session/claim")(
        ctx,
        new Request("https://dashboard.example/auth/session/claim", {
          headers: { cookie: "session:handoff=handoff-code" },
        }),
      );

      const replay = await routes.handler("GET", "/auth/session/claim")(
        ctx,
        new Request("https://dashboard.example/auth/session/claim", {
          headers: { cookie: "session:handoff=handoff-code" },
        }),
      );

      expect(first.status).toBe(302);
      expect(first.headers.get("location")).toBe("/");
      expect(first.headers.get("set-cookie")).toContain("session:refresh=session-1");

      expect(replay.status).toBe(400);
      await expect(replay.text()).resolves.toBe("Invalid or expired handoff.");
      expect(replay.headers.get("set-cookie")).toContain("session:handoff=;");
    });
  });
});
