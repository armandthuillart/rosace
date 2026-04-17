import type { Cookies } from "@sveltejs/kit";
import { describe, it, expect, vi } from "vite-plus/test";

import { getToken } from "./token";

// Mock the Better Auth cookie getter utility.
// Since better-auth is dynamic, we just mock the generator to return a predictable cookie name.
vi.mock("better-auth/cookies", () => ({
  createCookieGetter: () => (key: string) => ({ name: `mock-${key}` }),
}));

describe("getToken", () => {
  it("Extracts the mapped auth token from SvelteKit cookies.", () => {
    // 1. Arrange
    const mockCookies = {
      get: vi.fn().mockImplementation((name) => {
        if (name === "mock-auth:token") return "secret-session-123";
        return undefined;
      }),
    } as unknown as Cookies;

    // 2. Act
    const result = getToken(mockCookies);

    // 3. Assert
    expect(mockCookies.get).toHaveBeenCalledWith("mock-auth:token");
    expect(result).toBe("secret-session-123");
  });

  it("Returns undefined if the token is not present in the cookies.", () => {
    // 1. Arrange
    const mockCookies = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Cookies;

    // 2. Act
    const result = getToken(mockCookies);

    // 3. Assert
    expect(result).toBeUndefined();
  });
});
