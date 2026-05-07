import { describe, expect, it, vi } from "vite-plus/test";

const { HttpRouterMock, registerRoutesMock, routerInstance } = vi.hoisted(() => {
  const routerInstance = { __type: "http-router" };
  return {
    HttpRouterMock: vi.fn().mockImplementation(() => routerInstance),
    registerRoutesMock: vi.fn(),
    routerInstance,
  };
});

vi.mock("convex/server", () => ({
  HttpRouter: HttpRouterMock,
}));

vi.mock("./auth", () => ({
  registerRoutes: registerRoutesMock,
}));

import http from "./http";

describe("http module", () => {
  it("should create a router exactly once", () => {
    expect(HttpRouterMock).toHaveBeenCalledTimes(1);
  });

  it("should register auth routes on the created router", () => {
    expect(registerRoutesMock).toHaveBeenCalledTimes(1);
    expect(registerRoutesMock).toHaveBeenCalledWith(routerInstance);
  });

  it("should export the configured router instance", () => {
    expect(http).toEqual(routerInstance);
  });
});
