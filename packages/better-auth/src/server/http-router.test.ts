import { Hono } from "hono";
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

const { mockHttpActionGeneric } = vi.hoisted(() => {
  return { mockHttpActionGeneric: vi.fn((cb) => cb) };
});

vi.mock("convex/server", () => {
  class MockHttpRouter {
    parentRoutes: any[] = [];
    getRoutes() {
      return this.parentRoutes;
    }
    lookup(path: string, method: string) {
      if (path === "/api/parent" && method === "GET") {
        return ["parent_handler", "GET", path];
      }
      return null;
    }
  }
  return {
    HttpRouter: MockHttpRouter,
    httpActionGeneric: mockHttpActionGeneric,
    ROUTABLE_HTTP_METHODS: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  };
});

import { HttpRouter } from "./http-router";

describe("HttpRouter", () => {
  beforeEach(() => {
    mockHttpActionGeneric.mockClear();
  });

  it("Returns parent routes and Hono routes from getRoutes.", () => {
    const app = new Hono();
    app.get("/api/auth/sign-in", (c) => c.text("ok"));
    app.post("/api/auth/sign-in", (c) => c.text("ok"));

    const router = new HttpRouter(app);
    (router as any).parentRoutes = [["/api/parent", "GET", "parent_handler"]];

    const routes = router.getRoutes();

    expect(routes).toHaveLength(3); // 1 parent + 2 hono
    expect(routes[0]).toEqual(["/api/parent", "GET", "parent_handler"]);

    expect(routes[1][0]).toBe("/api/auth/sign-in");
    expect(routes[1][1]).toBe("GET");
    expect(routes[1][2]).toBeDefined();

    expect(routes[2][0]).toBe("/api/auth/sign-in");
    expect(routes[2][1]).toBe("POST");
    expect(routes[2][2]).toBeDefined();
  });

  it("Looks up parent routes first before Hono routes.", () => {
    const app = new Hono();
    app.get("/api/auth/sign-in", (c) => c.text("ok"));

    const router = new HttpRouter(app);

    const result = router.lookup("/api/parent", "GET");

    expect(result).toEqual(["parent_handler", "GET", "/api/parent"]);
  });

  it("Looks up Hono routes if parent does not match.", () => {
    const app = new Hono();
    app.post("/api/auth/sign-in", (c) => c.text("ok"));

    const router = new HttpRouter(app);

    const result = router.lookup("/api/auth/sign-in", "POST");

    expect(result).toBeDefined();
    expect(result?.[1]).toBe("POST");
    expect(result?.[2]).toBe("/api/auth/sign-in");
  });

  it("Translates HEAD requests to GET for Hono lookup.", () => {
    const app = new Hono();
    app.get("/api/auth/sign-in", (c) => c.text("ok"));

    const router = new HttpRouter(app);

    const result = router.lookup("/api/auth/sign-in", "HEAD");

    expect(result).toBeDefined();
    expect(result?.[1]).toBe("GET");
    expect(result?.[2]).toBe("/api/auth/sign-in");
  });

  it("Returns null for completely unknown routes.", () => {
    const app = new Hono();
    app.get("/api/auth/sign-in", (c) => c.text("ok"));

    const router = new HttpRouter(app);

    const result = router.lookup("/api/unknown", "GET");

    expect(result).toBeNull();
  });
});
