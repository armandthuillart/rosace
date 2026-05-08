import { describe, expect, it, vi } from "vite-plus/test";

const { actionMock, mutationMock, queryMock, registerRoutesMock, convexAuthMock } = vi.hoisted(
  () => {
    const actionMock = vi.fn();
    const mutationMock = vi.fn();
    const queryMock = vi.fn();
    const registerRoutesMock = vi.fn();
    const convexAuthMock = vi.fn(() => ({
      authStore: {
        action: actionMock,
        mutation: mutationMock,
        query: queryMock,
      },
      registerRoutes: registerRoutesMock,
    }));

    return { actionMock, mutationMock, queryMock, registerRoutesMock, convexAuthMock };
  },
);

vi.mock("@repo/auth/convex", () => ({
  convexAuth: convexAuthMock,
}));

import { action, mutation, query, registerRoutes } from "./auth";

describe("auth module", () => {
  it("should initialize auth once on module load", () => {
    expect(convexAuthMock).toHaveBeenCalledTimes(1);
  });

  it("should re-export authStore procedure helpers", () => {
    expect(query).toBe(queryMock);
    expect(mutation).toBe(mutationMock);
    expect(action).toBe(actionMock);
  });

  it("should re-export registerRoutes from convexAuth", () => {
    expect(registerRoutes).toBe(registerRoutesMock);
  });
});
