import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

type MockConvexClient = {
  clearAuth: ReturnType<typeof vi.fn>;
  setAuth: ReturnType<typeof vi.fn>;
};

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("convexClient", () => {
  let clientInstance: MockConvexClient;
  let ConvexHttpClientMock: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();

    clientInstance = {
      clearAuth: vi.fn(),
      setAuth: vi.fn(),
    };

    ConvexHttpClientMock = vi.fn(function MockConvexHttpClient() {
      return clientInstance;
    });
    fetchMock = vi.fn();

    vi.doMock("$env/dynamic/public", () => ({
      env: { PUBLIC_CONVEX_URL: "https://convex.example" },
    }));
    vi.doMock("$app/environment", () => ({ browser: true }));
    vi.doMock("convex/browser", () => ({ ConvexHttpClient: ConvexHttpClientMock }));

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("should clear auth when session fetch is disabled", async () => {
    const { convexClient } = await import("./client");

    const client = convexClient().useConvex({ shouldFetch: () => false });
    await flushAsyncWork();

    expect(client).toBe(clientInstance);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clientInstance.clearAuth).toHaveBeenCalledTimes(1);
    expect(clientInstance.setAuth).not.toHaveBeenCalled();
  });

  it("should clear auth on non-2xx session responses", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: vi.fn() });

    const { convexClient } = await import("./client");
    convexClient().useConvex({ shouldFetch: () => true });
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledWith("/auth/session", { credentials: "include" });
    expect(clientInstance.clearAuth).toHaveBeenCalledTimes(1);
    expect(clientInstance.setAuth).not.toHaveBeenCalled();
  });

  it("should clear auth on session with no token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
    });

    const { convexClient } = await import("./client");
    convexClient().useConvex({ shouldFetch: () => true });
    await flushAsyncWork();

    expect(clientInstance.setAuth).not.toHaveBeenCalled();
    expect(clientInstance.clearAuth).toHaveBeenCalledTimes(1);
  });

  it("should apply valid session token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        token: "session-jwt",
        expiresAt: 1_700_000_000_000,
        user: {
          _id: "user_1",
          _creationTime: 0,
          email: "user@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          plan: "pro",
        },
      }),
    });

    const { convexClient } = await import("./client");
    convexClient().useConvex({ shouldFetch: () => true });
    await flushAsyncWork();

    expect(clientInstance.setAuth).toHaveBeenCalledWith("session-jwt");
    expect(clientInstance.clearAuth).not.toHaveBeenCalled();
  });
});
