import type { Cookies } from "@sveltejs/kit";
import { describe, it, expect, vi } from "vite-plus/test";

import { getToken } from "./token";

vi.mock("better-auth/cookies", () => ({
  createCookieGetter: () => (key: string) => ({ name: `mock-${key}` }),
}));

describe("getToken", () => {
  it("Extracts the mapped auth token from SvelteKit cookies.", () => {
    const mockCookies = {
      get: vi.fn().mockImplementation((name) => {
        if (name === "mock-auth:token") return "secret-session-123";
        return undefined;
      }),
    } as unknown as Cookies;

    const result = getToken(mockCookies);

    expect(mockCookies.get).toHaveBeenCalledWith("mock-auth:token");
    expect(result).toBe("secret-session-123");
  });

  it("Returns undefined if the token is not present in the cookies.", () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Cookies;

    const result = getToken(mockCookies);

    expect(result).toBeUndefined();
  });
});
