import type { Context, Next } from "hono";
import { describe, it, expect, vi } from "vite-plus/test";

import { httpMiddleware } from "./http-middleware";

vi.mock("hono/cors", () => ({
  cors: () => async (c: Context, next: Next) => await next(),
}));

function createMockContext(path: string): Context {
  return {
    req: {
      path,
      raw: new Request(`http://localhost${path}`),
    } as unknown as Context["req"],
    env: {},
  } as unknown as Context;
}

describe("httpMiddleware", () => {
  process.env.DASHBOARD_URL = "http://localhost:3000";

  it("Bypasses middleware and calls next for non-auth routes.", async () => {
    const mockContext = createMockContext("/api/users/profile");
    const nextMock: Next = vi.fn().mockResolvedValue(undefined);
    const getAuthMock = vi.fn();

    const middleware = httpMiddleware({ getAuth: getAuthMock });

    const response = await middleware(mockContext, nextMock);

    expect(nextMock).toHaveBeenCalled();
    expect(getAuthMock).not.toHaveBeenCalled();
    expect(response).toBeUndefined();
  });

  it("Intercepts /api/auth routes and returns the Better Auth response.", async () => {
    const mockContext = createMockContext("/api/auth/sign-in");
    const nextMock: Next = vi.fn();

    const fakeAuthResponse = new Response('{"user":"id_1"}', {
      status: 200,
      headers: { "Set-Cookie": "better-auth-session=secret123; Path=/" },
    });

    const getAuthMock = vi.fn().mockReturnValue({
      handler: vi.fn().mockResolvedValue(fakeAuthResponse),
    });

    const middleware = httpMiddleware({ getAuth: getAuthMock });

    const response = await middleware(mockContext, nextMock);

    expect(nextMock).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(200);
    expect(response?.headers.get("Set-Cookie")).toBe("better-auth-session=secret123; Path=/");
  });

  it("Normalizes Better Auth errors into safe HTTP responses.", async () => {
    const mockContext = createMockContext("/api/auth/error");
    const nextMock: Next = vi.fn();

    const getAuthMock = vi.fn().mockReturnValue({
      handler: vi.fn().mockRejectedValue({
        statusCode: 400,
        body: { message: "Invalid credentials" },
      }),
    });

    const middleware = httpMiddleware({ getAuth: getAuthMock });

    const response = await middleware(mockContext, nextMock);

    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(400);

    const responseBody = await response?.json();
    expect(responseBody).toEqual({ message: "Invalid credentials" });
  });
});
