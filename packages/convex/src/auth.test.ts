import { describe, expect, it, vi } from "vite-plus/test";

const { mutationMock, queryMock, registerRoutesMock, convexAuthMock } = vi.hoisted(() => {
  const mutationMock = vi.fn();
  const queryMock = vi.fn();
  const registerRoutesMock = vi.fn();
  const convexAuthMock = vi.fn(() => ({
    authStore: {
      mutation: mutationMock,
      query: queryMock,
    },
    registerRoutes: registerRoutesMock,
  }));

  return { mutationMock, queryMock, registerRoutesMock, convexAuthMock };
});

vi.mock("@repo/auth/convex", () => ({
  convexAuth: convexAuthMock,
}));

import { mutation, query, registerRoutes } from "./auth";

describe("auth module", () => {
  it("should initialize auth once on module load", () => {
    expect(convexAuthMock).toHaveBeenCalledTimes(1);
  });

  it("should re-export authStore procedure helpers", () => {
    expect(query).toBe(queryMock);
    expect(mutation).toBe(mutationMock);
  });

  it("should re-export registerRoutes from convexAuth", () => {
    expect(registerRoutes).toBe(registerRoutesMock);
  });
});
