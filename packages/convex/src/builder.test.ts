import { describe, it, assertType, expect } from "vite-plus/test";
import { v } from "convex/values";
import { createBuilder } from "./builder";

const convex = createBuilder();

describe("API chain types", () => {
  it("should prevent .input() before selecting function kind", () => {
    expect(() => (convex as any).input({ id: v.string() })).toThrow(TypeError);
  });

  it("should prevent .handler() before selecting function kind", () => {
    expect(() => (convex as any).handler(async () => ({}))).toThrow(TypeError);
  });

  it("should prevent .public() before .handler()", () => {
    const builder = convex.query().input({ id: v.string() });

    expect(() => (builder as any).public()).toThrow(TypeError);
  });

  it("should prevent .handler() twice", () => {
    const builder = convex.query().handler(async () => ({}));

    expect(() => (builder as any).handler(async () => ({}))).toThrow(TypeError);
  });

  it("should prevent .returns() after .handler()", () => {
    const builder = convex.query().handler(async () => ({}));

    expect(() => (builder as any).returns(v.object({}))).toThrow(TypeError);
  });

  it("should reject mismatched .returns() type", () => {
    convex
      .query()
      .input({ count: v.number() })
      .returns(v.array(v.number()))
      .handler(async () => [1, 2, 3]);

    convex
      .query()
      .input({ count: v.number() })
      .returns(v.array(v.number()))
      // @ts-expect-error - handler returns string[], expects number[]
      .handler(async () => ["1", "2", "3"]);
  });

  it("should make .handler() result callable", async () => {
    const callable = convex
      .query()
      .input({ id: v.string() })
      .handler(async (ctx, args) => args.id);

    assertType<(ctx: any, args: { id: string }) => Promise<string>>(callable);

    const result = await callable({} as any, { id: "hello" });

    expect(result).toBe("hello");
  });

  it("should provide function-appropriate context types", () => {
    convex.query().handler(async (ctx) => {
      assertType(ctx.db);
      assertType(ctx.auth);
      return {};
    });

    convex.action().handler(async (ctx) => {
      assertType(ctx.auth);
      assertType(ctx.scheduler);
      return {};
    });
  });
});

describe("middleware execution", () => {
  it("should pass args through with no middleware", async () => {
    const fn = convex
      .query()
      .input({ name: v.string(), count: v.number() })
      .handler(async (_ctx, args) => ({ name: args.name, count: args.count }));

    const result = await fn({} as any, { name: "test", count: 42 });

    expect(result).toEqual({ name: "test", count: 42 });
  });

  it("should enrich context through middleware chain", async () => {
    const addA = convex.query().createMiddleware(async (ctx, next) => next({ ...ctx, a: 1 }));
    const addB = convex.query().createMiddleware(async (ctx, next) => next({ ...ctx, b: 2 }));

    const fn = convex
      .query()
      .use(addA)
      .use(addB)
      .handler(async (ctx: any) => ({ a: ctx.a, b: ctx.b }));

    const result = await fn({} as any, {});

    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("should execute middlewares in registration order", async () => {
    const order: string[] = [];
    const first = convex.query().createMiddleware(async (ctx, next) => {
      order.push("first");
      return next(ctx);
    });
    const second = convex.query().createMiddleware(async (ctx, next) => {
      order.push("second");
      return next(ctx);
    });

    const fn = convex
      .query()
      .use(first)
      .use(second)
      .handler(async () => {
        order.push("handler");
      });

    await fn({} as any, {});

    expect(order).toEqual(["first", "second", "handler"]);
  });

  it("should propagate errors thrown before next()", async () => {
    const failing = convex.query().createMiddleware(async (_ctx, _next) => {
      throw new Error("middleware failed");
    });

    const fn = convex
      .query()
      .use(failing)
      .handler(async () => "should not reach");

    await expect(fn({} as any, {})).rejects.toThrow("middleware failed");
  });

  it("should propagate errors thrown after next()", async () => {
    const failsAfter = convex.query().createMiddleware(async (ctx, next) => {
      await next(ctx);
      throw new Error("middleware failed after next");
    });

    const fn = convex
      .query()
      .use(failsAfter)
      .handler(async () => "handler ran");

    await expect(fn({} as any, {})).rejects.toThrow("middleware failed after next");
  });

  it("should propagate handler errors through all middleware layers", async () => {
    const order: string[] = [];
    const outer = convex.query().createMiddleware(async (ctx, next) => {
      order.push("outer-before");
      try {
        return await next(ctx);
      } catch (e) {
        order.push("outer-catch");
        throw e;
      }
    });
    const inner = convex.query().createMiddleware(async (ctx, next) => {
      order.push("inner-before");
      try {
        return await next(ctx);
      } catch (e) {
        order.push("inner-catch");
        throw e;
      }
    });

    const fn = convex
      .query()
      .use(outer)
      .use(inner)
      .handler(async () => {
        throw new Error("boom");
      });

    await expect(fn({} as any, {})).rejects.toThrow("boom");
    expect(order).toEqual(["outer-before", "inner-before", "inner-catch", "outer-catch"]);
  });

  it("should work with no middleware at all", async () => {
    const fn = convex.query().handler(async () => "no middleware");

    const result = await fn({} as any, {});

    expect(result).toBe("no middleware");
  });

  it("should register as a public query through .public()", async () => {
    const registered = convex
      .query()
      .handler(async () => ({}))
      .public();

    expect(registered).toBeDefined();
    expect(typeof registered).toBe("function");
  });
});
