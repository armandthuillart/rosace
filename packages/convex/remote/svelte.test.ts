import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

type MockConvexClient = {
  clearAuth: ReturnType<typeof vi.fn>;
  setAuth: ReturnType<typeof vi.fn>;
};

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("convexClient security/regression guarantees", () => {
  let clientInstance: MockConvexClient;
  let ConvexHttpClientMock: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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
    vi.doMock("convex/browser", () => ({
      ConvexHttpClient: ConvexHttpClientMock,
    }));

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("guarantees auth is cleared when session fetch is disabled (fail-closed)", async () => {
    const { convexClient } = await import("./svelte");

    const client = convexClient().useConvex({ shouldFetch: () => false });
    await flushAsyncWork();

    expect(client).toBe(clientInstance);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clientInstance.clearAuth).toHaveBeenCalledTimes(1);
    expect(clientInstance.setAuth).not.toHaveBeenCalled();
  });

  it("guarantees non-2xx session responses clear auth and never set attacker-controlled state", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn(),
    });
    const { convexClient } = await import("./svelte");

    // act
    convexClient().useConvex({ shouldFetch: () => true });
    await flushAsyncWork();

    // assert
    expect(fetchMock).toHaveBeenCalledWith("https://convex.example/auth/session", {
      credentials: "include",
    });
    expect(clientInstance.clearAuth).toHaveBeenCalledTimes(1);
    expect(clientInstance.setAuth).not.toHaveBeenCalled();
  });

  it("guarantees malformed or null session payloads fail closed by clearing auth", async () => {
    // arrange
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
    });
    const { convexClient } = await import("./svelte");

    // act
    convexClient().useConvex({ shouldFetch: () => true });
    await flushAsyncWork();

    // assert
    expect(clientInstance.setAuth).not.toHaveBeenCalled();
    expect(clientInstance.clearAuth).toHaveBeenCalledTimes(1);
  });

  it("guarantees valid session token is applied and stale auth is not cleared", async () => {
    // arrange
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        token: "session-jwt",
        expires: 1_700_000_000_000,
        user: {
          email: "user@example.com",
          firstName: "Ada",
          id: "user_1",
          lastName: "Lovelace",
          plan: "pro",
          verified: true,
        },
      }),
    });
    const { convexClient } = await import("./svelte");

    // act
    convexClient().useConvex({ shouldFetch: () => true });
    await flushAsyncWork();

    // assert
    expect(clientInstance.setAuth).toHaveBeenCalledWith("session-jwt");
    expect(clientInstance.clearAuth).not.toHaveBeenCalled();
  });

  it("guarantees convex http client singleton reuse to prevent auth-desync regressions", async () => {
    // arrange
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(null),
    });
    const { convexClient } = await import("./svelte");

    // act
    const first = convexClient().useConvex({ shouldFetch: () => true });
    const second = convexClient().useConvex({ shouldFetch: () => true });
    await flushAsyncWork();

    // assert
    expect(first).toBe(second);
    expect(ConvexHttpClientMock).toHaveBeenCalledTimes(1);
  });
});
