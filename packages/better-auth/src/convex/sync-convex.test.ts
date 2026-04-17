import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

import { syncConvex } from "./sync-convex";

type MockAuthClient = Parameters<typeof syncConvex>[0]["authClient"];

const mockSetAuth = vi.fn();
vi.mock("convex/browser", () => ({
  ConvexClient: vi.fn().mockImplementation(function () {
    return {
      setAuth: mockSetAuth,
    };
  }),
}));

const mockSetContext = vi.fn();
vi.mock("svelte", () => ({
  setContext: (...args: any[]) => mockSetContext(...args),
}));

// 1. Mock dependencies
vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_CONVEX_URL: "https://mock-convex.convex.cloud" },
}));

describe("syncConvex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Initializes ConvexClient and sets it in the Svelte context.", () => {
    // 1. Arrange
    const authClient = {
      $store: { listen: vi.fn() },
      useSession: vi.fn(),
    } as unknown as MockAuthClient;
    const hasToken = vi.fn().mockResolvedValue(false);

    // 2. Act
    syncConvex({ authClient, hasToken });

    // 3. Assert
    expect(mockSetContext).toHaveBeenCalledWith("$$_convex", expect.anything());
  });

  it("Immediately sets auth on the ConvexClient if hasToken resolves to true.", async () => {
    // 1. Arrange
    const authClient = {
      $store: { listen: vi.fn() },
      useSession: vi.fn(),
    } as unknown as MockAuthClient;
    const hasToken = vi.fn().mockResolvedValue(true);

    // 2. Act
    syncConvex({ authClient, hasToken });

    // Wait for the internal void promise to resolve
    await new Promise((resolve) => process.nextTick(resolve));

    // 3. Assert
    expect(mockSetAuth).toHaveBeenCalled();
  });

  it("Listens to the session signal and updates auth state on logout.", async () => {
    // 1. Arrange
    let capturedListener: () => void = () => {};
    let capturedSubscriber: (s: any) => void = () => {};

    const authClient = {
      $store: {
        listen: vi.fn().mockImplementation((event, cb) => {
          if (event === "$sessionSignal") capturedListener = cb;
        }),
      },
      useSession: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockImplementation((cb: any) => {
          capturedSubscriber = cb;
        }),
      }),
    } as unknown as MockAuthClient;

    const hasToken = vi.fn().mockResolvedValue(false);

    // 2. Act
    syncConvex({ authClient, hasToken });

    // Simulate Better Auth internal trigger
    capturedListener();

    // Simulate session logout payload
    capturedSubscriber({ data: null });

    // 3. Assert
    // The subscriber triggers setAuth with an async () => null fetcher
    expect(mockSetAuth).toHaveBeenCalled();
    const fetcherFunction = mockSetAuth.mock.calls[0][0];

    const token = await fetcherFunction();
    expect(token).toBeNull();
  });

  it("Listens to the session signal and updates auth state on login.", async () => {
    // 1. Arrange
    let capturedListener: () => void = () => {};
    let capturedSubscriber: (s: any) => void = () => {};

    const mockTokenFetcher = vi.fn().mockResolvedValue({
      data: { token: "real-convex-token" },
      error: null,
    });

    const authClient = {
      $store: {
        listen: vi.fn().mockImplementation((event, cb) => {
          if (event === "$sessionSignal") capturedListener = cb;
        }),
      },
      useSession: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockImplementation((cb: any) => {
          capturedSubscriber = cb;
        }),
      }),
      convex: {
        token: mockTokenFetcher,
      },
    } as unknown as MockAuthClient;

    const hasToken = vi.fn().mockResolvedValue(false);

    // 2. Act
    syncConvex({ authClient, hasToken });

    // Simulate Better Auth internal trigger
    capturedListener();

    // Simulate session login payload
    capturedSubscriber({ data: { user: { id: "user_1" } } });

    // 3. Assert
    // The subscriber triggers setAuth with a real fetcher
    expect(mockSetAuth).toHaveBeenCalled();
    const fetcherFunction = mockSetAuth.mock.calls[0][0];

    const token = await fetcherFunction();
    expect(token).toBe("real-convex-token");
    expect(mockTokenFetcher).toHaveBeenCalled();
  });
});
