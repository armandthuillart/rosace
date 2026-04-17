import type { RequestEvent } from "@sveltejs/kit";
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

import { requestHandler } from "./handler";

// Mock the SvelteKit environment
vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_CONVEX_SITE_URL: "https://api.convex.cloud" },
}));

const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

describe("handler", () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  it("Forwards GET requests to the Convex site URL preserving headers.", async () => {
    // 1. Arrange
    const { GET } = requestHandler("https://api.convex.cloud");
    const mockRequest = new Request("http://localhost/api/auth/sign-in?foo=bar", {
      method: "GET",
      headers: { cookie: "session=123", "content-type": "application/json" },
    });

    // 2. Act
    await GET({ request: mockRequest } as unknown as RequestEvent);

    // 3. Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [targetUrl, options] = fetchMock.mock.calls[0];

    expect(targetUrl.toString()).toBe("https://api.convex.cloud/api/auth/sign-in?foo=bar");
    expect(options.method).toBe("GET");
    expect(options.headers).toBeInstanceOf(Headers);
    expect((options.headers as Headers).get("cookie")).toBe("session=123");
    expect((options.headers as Headers).get("content-type")).toBe("application/json");
    expect((options.headers as Headers).get("accept-encoding")).toBe("application/json");
    expect((options.headers as Headers).get("host")).toBe("api.convex.cloud");
    expect((options.headers as Headers).get("x-forwarded-host")).toBe("localhost");
    expect((options.headers as Headers).get("x-forwarded-proto")).toBe("http");
    expect((options.headers as Headers).get("x-better-auth-forwarded-host")).toBe("localhost");
    expect((options.headers as Headers).get("x-better-auth-forwarded-proto")).toBe("http");
    expect(options.redirect).toBe("manual");
  });

  it("Forwards POST requests preserving body and headers.", async () => {
    // 1. Arrange
    const { POST } = requestHandler("https://api.convex.cloud");
    const mockRequest = new Request("http://localhost/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });

    // 2. Act
    await POST({ request: mockRequest } as unknown as RequestEvent);

    // 3. Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [targetUrl, options] = fetchMock.mock.calls[0];

    expect(targetUrl.toString()).toBe("https://api.convex.cloud/api/auth/sign-in");
    expect(options.method).toBe("POST");
    // The request body stream is strictly passed through without modification
    expect(options.body).toBe(mockRequest.body);
  });
});
