import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { describe, expect, it, vi } from "vite-plus/test";

import { createBuilder } from "./index";
import type { QueryCtx } from "./types";

function mockQueryCtx() {
  return {} as QueryCtx;
}

const schema = defineSchema({
  logs: defineTable({
    value: v.string(),
  }),
});
const modules = import.meta.glob("../src/**/*.ts");

describe("procedure builder security/regression guarantees", () => {
  it("guarantees middlewares execute in declared order and cannot bypass handler output", async () => {
    const order: string[] = [];
    const builder = createBuilder();

    const first = builder.createMiddleware(async (ctx, next) => {
      order.push("mw:first:before");
      const result = await next(ctx);
      order.push("mw:first:after");
      return { context: result.context };
    });

    const second = builder.createMiddleware(async (ctx, next) => {
      order.push("mw:second:before");
      const result = await next(ctx);
      order.push("mw:second:after");
      return { context: result.context };
    });

    const procedure = builder
      .query()
      .use(first)
      .use(second)
      .handler(async (ctx) => {
        void ctx;
        order.push("handler");
        return "ok";
      });

    const output = await procedure(mockQueryCtx(), {});

    expect(output).toBe("ok");
    expect(order).toEqual([
      "mw:first:before",
      "mw:second:before",
      "handler",
      "mw:second:after",
      "mw:first:after",
    ]);
  });

  it("guarantees middleware chains that never call next fail closed with a clear error", async () => {
    const builder = createBuilder();
    const swallow = builder.createMiddleware(async (ctx, _next) => {
      return { context: ctx };
    });

    const procedure = builder
      .query()
      .use(swallow)
      .handler(async () => {
        return "should-not-run";
      });

    await expect(procedure(mockQueryCtx(), {})).rejects.toThrow(
      "Middleware chain completed without calling the handler.",
    );
  });

  it("guarantees callable procedure surface does not expose handler reassignment hooks", () => {
    const builder = createBuilder();
    const withHandler = builder.query().handler(async () => "first");

    expect(typeof (withHandler as { handler?: unknown }).handler).toBe("undefined");
  });

  it("guarantees middleware added after handler still executes before handler logic", async () => {
    const builder = createBuilder();
    const order: string[] = [];
    const appendAudit = builder.createMiddleware(async (ctx, next) => {
      order.push("middleware");
      return next(ctx);
    });

    const procedure = builder
      .query()
      .handler(async () => {
        order.push("handler");
        return "ok";
      })
      .use(appendAudit);

    const result = await procedure(mockQueryCtx(), {});

    expect(result).toBe("ok");
    expect(order).toEqual(["middleware", "handler"]);
  });

  it("guarantees middleware exceptions propagate and stop downstream execution", async () => {
    const builder = createBuilder();
    const downstream = vi.fn(async () => "ok");
    const thrower = builder.createMiddleware(async () => {
      throw new Error("blocked");
    });

    const procedure = builder.query().use(thrower).handler(downstream);

    await expect(procedure(mockQueryCtx(), {})).rejects.toThrow("blocked");
    expect(downstream).not.toHaveBeenCalled();
  });
});

describe("procedure builder convex-test integration guarantees", () => {
  it("guarantees callable procedures run safely with a real Convex query context", async () => {
    const t = convexTest({ schema, modules });
    const builder = createBuilder();
    const order: string[] = [];

    const auditMiddleware = builder.createMiddleware(async (ctx, next) => {
      order.push("mw");
      return next(ctx);
    });

    const procedure = builder
      .query()
      .use(auditMiddleware)
      .handler(async (ctx) => {
        void ctx.db;
        order.push("handler");
        return "ok";
      });

    const output = await t.query(async (ctx) => procedure(ctx as unknown as QueryCtx, {}));

    expect(output).toBe("ok");
    expect(order).toEqual(["mw", "handler"]);
  });

  it("guarantees fail-closed behavior still holds with real Convex execution context", async () => {
    const t = convexTest({ schema, modules });
    const builder = createBuilder();

    const swallow = builder.createMiddleware(async (ctx, _next) => ({ context: ctx }));
    const procedure = builder
      .query()
      .use(swallow)
      .handler(async () => "unreachable");

    await expect(t.query(async (ctx) => procedure(ctx as unknown as QueryCtx, {}))).rejects.toThrow(
      "Middleware chain completed without calling the handler.",
    );
  });
});
