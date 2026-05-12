import { defineSchema, defineTable, type DataModelFromSchemaDefinition } from 'convex/server';
import { v } from 'convex/values';
import { describe, it, assertType, expect } from 'vite-plus/test';

import { createBuilder, ConvexBuilderWithHandler, ConvexBuilderWithFunction } from './builder';

const schema = defineSchema({ numbers: defineTable({ value: v.number() }) });
const convex = createBuilder<DataModelFromSchemaDefinition<typeof schema>>();

describe('function kind selection', () => {
  it('should prevent .input() before selecting function kind', () => {
    // @ts-expect-error - ConvexBuilder does not have .input(). Call .query(), .mutation(), or .action() first.
    expect(() => convex.input({ id: v.string() })).toThrow();
  });

  it('should prevent .handler() before selecting function kind', () => {
    // @ts-expect-error - ConvexBuilder does not have .handler(). Call .query(), .mutation(), or .action() first.
    expect(() => convex.handler(async () => ({ success: true }))).toThrow();
  });

  it('should prevent .use() before selecting function kind', () => {
    const authMiddleware = convex.query().createMiddleware(async (context, next) => next(context));

    // @ts-expect-error - ConvexBuilder does not have .use().
    expect(() => convex.use(authMiddleware)).toThrow();
  });

  it('should allow .query() to be called first', () => {
    const builder = convex.query();
    assertType<typeof builder>(builder);
  });

  it('should allow .mutation() to be called first', () => {
    const builder = convex.mutation();
    assertType<typeof builder>(builder);
  });

  it('should allow .action() to be called first', () => {
    const builder = convex.action();
    assertType<typeof builder>(builder);
  });
});

describe('order of operations', () => {
  it('should prevent .public() before .handler()', () => {
    const builder = convex.query().input({ id: v.string() });

    // @ts-expect-error - ConvexBuilderWithFunction does not have .public(). Call .handler() first.
    expect(() => builder.public()).toThrow();
  });

  it('should prevent .internal() before .handler()', () => {
    const builder = convex.mutation().input({ name: v.string() });

    // @ts-expect-error - ConvexBuilderWithFunction does not have .internal(). Call .handler() first.
    expect(() => builder.internal()).toThrow();
  });

  it('should allow .public() after .handler()', () => {
    convex
      .query()
      .input({ id: v.string() })
      .handler(async (context, input) => ({ id: input.id }))
      .public();
  });

  it('should allow .internal() after .handler()', () => {
    convex
      .query()
      .input({ id: v.string() })
      .handler(async (context, input) => ({ id: input.id }))
      .internal();
  });

  it('should allow .returns() before .handler()', () => {
    convex
      .query()
      .input({ count: v.number() })
      .returns(v.object({ numbers: v.array(v.number()) }))
      .handler(async () => ({ numbers: [1, 2, 3] }));
  });

  it('should prevent .returns() after .handler()', () => {
    const builder = convex
      .query()
      .input({ count: v.number() })
      .handler(async () => ({ numbers: [1, 2, 3] }));

    // @ts-expect-error - ConvexBuilderWithHandler does not have .returns(). Call .returns() before .handler().
    expect(() => builder.returns(v.object({ numbers: v.array(v.number()) }))).toThrow();
  });
});

describe('handler uniqueness', () => {
  it('should prevent .handler() twice on query', () => {
    const builder = convex
      .query()
      .input({ id: v.string() })
      .handler(async (context, input) => ({ id: input.id }));

    // @ts-expect-error - ConvexBuilderWithHandler does not have .handler()
    expect(() => builder.handler(async () => ({ error: 'should not be called' }))).toThrow();
  });

  it('should prevent .handler() twice on mutation', () => {
    const builder = convex
      .mutation()
      .input({ name: v.string() })
      .handler(async (context, input) => ({ name: input.name }));

    // @ts-expect-error - ConvexBuilderWithHandler does not have .handler()
    expect(() => builder.handler(async () => ({ error: 'should not be called' }))).toThrow();
  });

  it('should prevent .handler() twice on action', () => {
    const builder = convex
      .action()
      .input({ url: v.string() })
      .handler(async (context, input) => ({ url: input.url }));

    // @ts-expect-error - ConvexBuilderWithHandler does not have .handler().
    expect(() => builder.handler(async () => ({ error: 'should not be called' }))).toThrow();
  });

  it('should prevent .handler() twice even with middleware in between', () => {
    const authMiddleware = convex.query().createMiddleware(async (context, next) => next(context));

    const builder = convex
      .query()
      .input({ id: v.string() })
      .handler(async (context, input) => ({ id: input.id }))
      .use(authMiddleware);

    // @ts-expect-error - ConvexBuilderWithHandler does not have .handler().
    expect(() => builder.handler(async () => ({ error: 'should not be called' }))).toThrow();
  });

  it('should prevent .handler() twice even with returns validator', () => {
    const builder = convex
      .query()
      .input({ count: v.number() })
      .returns(v.object({ numbers: v.array(v.number()) }))
      .handler(async () => ({ numbers: [1, 2, 3] }));

    // @ts-expect-error - ConvexBuilderWithHandler does not have .handler().
    expect(() => builder.handler(async () => ({ numbers: [] }))).toThrow();
  });

  it('should allow chaining .use() after .handler()', () => {
    const authMiddleware = convex.query().createMiddleware(async (context, next) => next(context));

    const builder = convex
      .query()
      .input({ id: v.string() })
      .handler(async (context, input) => ({ id: input.id }))
      .use(authMiddleware);

    assertType<typeof builder>(builder);
  });
});

describe('callable builder', () => {
  it('should make ConvexBuilderWithHandler callable', () => {
    const nonRegisteredQuery = convex
      .query()
      .input({ count: v.number() })
      .handler(async (context, input) => `the count is ${input.count}`);

    assertType<(context: any, args: { count: number }) => Promise<string>>(nonRegisteredQuery);
  });

  it('should make registered queries non-callable', () => {
    const nonRegisteredQuery = convex
      .query()
      .input({ count: v.number() })
      .handler(async (context, input) => `the count is ${input.count}`);

    const registeredQuery = nonRegisteredQuery.public();

    expect(registeredQuery).not.toBe(nonRegisteredQuery);
    expect((registeredQuery as any).handler).toBeUndefined();
  });

  it('should make registered mutations non-callable', () => {
    const nonRegisteredMutation = convex
      .mutation()
      .input({ value: v.number() })
      .handler(async (context, input) => `value is ${input.value}`);

    const registeredMutation = nonRegisteredMutation.public();

    expect(registeredMutation).not.toBe(nonRegisteredMutation);
    expect((registeredMutation as any).handler).toBeUndefined();
  });

  it('should make registered actions non-callable', () => {
    const nonRegisteredAction = convex
      .action()
      .input({ url: v.string() })
      .handler(async (context, input) => ({ url: input.url }));

    const registeredAction = nonRegisteredAction.public();

    expect(registeredAction).not.toBe(nonRegisteredAction);
    expect((registeredAction as any).handler).toBeUndefined();
  });

  it('should make internal registered queries non-callable', () => {
    const nonRegisteredQuery = convex
      .query()
      .input({ count: v.number() })
      .handler(async (context, input) => ({ count: input.count }));

    const registeredQuery = nonRegisteredQuery.internal();

    expect(registeredQuery).not.toBe(nonRegisteredQuery);
    expect((registeredQuery as any).handler).toBeUndefined();
  });

  it('should preserve callability through middleware chain', () => {
    const authMiddleware = convex
      .query()
      .createMiddleware(async (context, next) => next({ ...context, userId: 'user-123' }));

    const callableQuery = convex
      .query()
      .input({ count: v.number() })
      .use(authMiddleware)
      .handler(async (context, input) => ({
        count: input.count,
        userId: (context as any).userId,
      }));

    assertType<
      (context: any, args: { count: number }) => Promise<{ count: number; userId: string }>
    >(callableQuery);
  });

  it('should preserve callability after multiple middleware', () => {
    const authMiddleware = convex
      .query()
      .createMiddleware(async (context, next) => next({ ...context, userId: 'user-123' }));

    const loggingMiddleware = convex
      .query()
      .createMiddleware(async (context, next) => next({ ...context, requestId: 'req-123' }));

    const callableQuery = convex
      .query()
      .input({ count: v.number() })
      .use(authMiddleware)
      .use(loggingMiddleware)
      .handler(async (context, input) => ({
        count: input.count,
      }));

    assertType<(context: any, args: { count: number }) => Promise<{ count: number }>>(
      callableQuery,
    );
  });

  it('should work with mutations', () => {
    const callableMutation = convex
      .mutation()
      .input({ value: v.number() })
      .handler(async (context, input) => `value is ${input.value}`);

    assertType<(context: any, args: { value: number }) => Promise<string>>(callableMutation);
  });

  it('should work with actions', () => {
    const callableAction = convex
      .action()
      .input({ url: v.string() })
      .handler(async (context, input) => ({ url: input.url }));

    assertType<(context: any, args: { url: string }) => Promise<{ url: string }>>(callableAction);
  });

  it('should work with optional input', () => {
    const callableQuery = convex
      .query()
      .input({ name: v.optional(v.string()), count: v.optional(v.number()) })
      .handler(async (context, input) => ({
        name: input.name,
        count: input.count,
      }));

    assertType<
      (
        context: any,
        args: { name?: string; count?: number },
      ) => Promise<{ name?: string; count?: number }>
    >(callableQuery);
  });

  it('should work with return validators', () => {
    const callableQuery = convex
      .query()
      .input({ count: v.number() })
      .returns(v.object({ numbers: v.array(v.number()) }))
      .handler(async (context, input) => ({
        numbers: Array(input.count)
          .fill(0)
          .map((_, i) => i),
      }));

    assertType<(context: any, args: { count: number }) => Promise<{ numbers: number[] }>>(
      callableQuery,
    );
  });

  it('should work with no input', () => {
    const callableQuery = convex.query().handler(async () => ({ success: true }));

    assertType<(context: any, args: Record<never, never>) => Promise<{ success: boolean }>>(
      callableQuery,
    );
  });

  it('should infer one-arg handlers with empty input objects', () => {
    const callableQuery = convex
      .query()
      .input({})
      .handler(async (context) => {
        assertType(context.db);
        return { success: Boolean(context.db) };
      });

    assertType<(context: any, args: Record<never, never>) => Promise<{ success: boolean }>>(
      callableQuery,
    );
  });

  it('should lose callability after .public()', () => {
    const callableQuery = convex
      .query()
      .input({ count: v.number() })
      .handler(async (context, input) => ({ count: input.count }));

    assertType<(context: any, args: { count: number }) => Promise<{ count: number }>>(
      callableQuery,
    );

    const registeredQuery = callableQuery.public();

    expect(registeredQuery).not.toBe(callableQuery);
    expect((registeredQuery as any).handler).toBeUndefined();
  });

  it('should lose callability after .internal()', () => {
    const callableMutation = convex
      .mutation()
      .input({ value: v.number() })
      .handler(async (context, input) => `value is ${input.value}`);

    assertType<(context: any, args: { value: number }) => Promise<string>>(callableMutation);

    const registeredMutation = callableMutation.internal();

    expect(registeredMutation).not.toBe(callableMutation);
    expect((registeredMutation as any).handler).toBeUndefined();
  });
});

describe('context types per function', () => {
  it('queries should have db and auth', () => {
    convex
      .query()
      .input({ id: v.string() })
      .handler(async (context) => {
        assertType(context.db);
        assertType(context.auth);
        return { success: true };
      })
      .public();
  });

  it('mutations should have db and auth', () => {
    convex
      .mutation()
      .input({ name: v.string() })
      .handler(async (context) => {
        assertType(context.db);
        assertType(context.auth);
        return { success: true };
      })
      .public();
  });

  it('actions should have auth and scheduler', () => {
    convex
      .action()
      .input({ url: v.string() })
      .handler(async (context) => {
        assertType(context.auth);
        assertType(context.scheduler);
        return { success: true };
      })
      .public();
  });
});

describe('returns validation', () => {
  it('should accept Convex return validators', () => {
    convex
      .query()
      .input({ count: v.number() })
      .returns(v.object({ numbers: v.array(v.number()) }))
      .handler(async () => ({ numbers: [1, 2, 3] }));
  });

  it('should reject incorrect return type when .returns() is specified', () => {
    convex
      .query()
      .input({ count: v.number() })
      .returns(v.object({ numbers: v.array(v.number()) }))
      // @ts-expect-error - Return type mismatch: handler returns { count: number } but .returns() expects { numbers: number[] }.
      .handler(async () => ({ count: 5 }));
  });

  it('should reject return type with missing required property', () => {
    convex
      .query()
      .input({ count: v.number() })
      .returns(v.object({ numbers: v.array(v.number()), total: v.number() }))
      // @ts-expect-error - Return type mismatch: missing 'total' property.
      .handler(async () => ({ numbers: [1, 2, 3] }));
  });

  it('should reject return type with wrong property type', () => {
    convex
      .query()
      .input({ count: v.number() })
      .returns(v.object({ numbers: v.array(v.number()) }))
      // @ts-expect-error - Return type mismatch: 'numbers' should be number[] but is string[].
      .handler(async () => ({ numbers: ['1', '2', '3'] }));
  });

  it('should enforce array return types', () => {
    convex
      .query()
      .input({ count: v.number() })
      .returns(v.array(v.number()))
      .handler(async () => [1, 2, 3]);
  });

  it('should reject wrong array return type', () => {
    convex
      .query()
      .input({ count: v.number() })
      .returns(v.array(v.number()))
      // @ts-expect-error - Return type mismatch: handler returns string[] but .returns() expects number[].
      .handler(async () => ['1', '2', '3']);
  });

  it('should allow any return type when .returns() is not specified', () => {
    convex
      .query()
      .input({ count: v.number() })
      .handler(async () => ({ numbers: [1, 2, 3] }));
    convex
      .query()
      .input({ count: v.number() })
      .handler(async () => ({ count: 5 }));
    convex
      .query()
      .input({ count: v.number() })
      .handler(async () => 42);
  });

  it('should enforce return type for mutations', () => {
    convex
      .mutation()
      .input({ value: v.number() })
      .returns(v.id('numbers'))
      .handler(async (context, input) => context.db.insert('numbers', { value: input.value }));
  });

  it('should reject incorrect return type for mutations', () => {
    convex
      .mutation()
      .input({ value: v.number() })
      .returns(v.id('numbers'))
      // @ts-expect-error - Return type mismatch: handler returns string but .returns() expects Id<"numbers">.
      .handler(async () => 'wrong-type');
  });

  it('should enforce return type for actions', () => {
    convex
      .action()
      .input({ count: v.number() })
      .returns(v.array(v.number()))
      .handler(async () => [1, 2, 3]);
  });

  it('should reject incorrect return type for actions', () => {
    convex
      .action()
      .input({ count: v.number() })
      .returns(v.array(v.number()))
      // @ts-expect-error - Return type mismatch: handler returns string but .returns() expects number[].
      .handler(async () => 'wrong');
  });
});

describe('runtime guards', () => {
  it('should throw when .public() is called without .handler()', () => {
    const handlerless = new (ConvexBuilderWithHandler as any)({
      functionType: 'query',
      middlewares: [],
      argsValidator: undefined,
      returnsValidator: undefined,
      handler: undefined,
    });

    expect(() => handlerless.public()).toThrow('Handler not set');
  });

  it('should throw when .internal() is called without .handler()', () => {
    const handlerless = new (ConvexBuilderWithHandler as any)({
      functionType: 'query',
      middlewares: [],
      argsValidator: undefined,
      returnsValidator: undefined,
      handler: undefined,
    });

    expect(() => handlerless.internal()).toThrow('Handler not set');
  });

  it('should throw when .public() is called without function type', () => {
    const noFunctionType = new (ConvexBuilderWithHandler as any)({
      functionType: undefined,
      middlewares: [],
      argsValidator: undefined,
      returnsValidator: undefined,
      handler: async () => 'test',
    });

    expect(() => noFunctionType.public()).toThrow('Function type not set');
  });

  it('should throw if handler is set twice via internal def', () => {
    const withHandler = new (ConvexBuilderWithFunction as any)({
      functionType: 'query',
      middlewares: [],
      argsValidator: undefined,
      returnsValidator: undefined,
      handler: async () => 'first',
    });

    expect(() => withHandler.handler(async () => 'second')).toThrow('Handler already defined');
  });
});

describe('$context() consistency', () => {
  it('$context() should return a middleware helper, not a builder', () => {
    const result = convex.query().$context<{ auth: unknown }>();

    expect(result).toHaveProperty('createMiddleware');
    expect(typeof result.createMiddleware).toBe('function');
    expect((result as any).input).toBeUndefined();
    expect((result as any).handler).toBeUndefined();
    expect((result as any).use).toBeUndefined();
  });

  it('middleware created via $context().createMiddleware() should be usable with .use()', async () => {
    const authMiddleware = convex
      .query()
      .$context<{ auth: unknown }>()
      .createMiddleware(async (context, next) =>
        next({ ...context, user: { id: '1', name: 'Alice' } }),
      );

    const fn = convex
      .query()
      .use(authMiddleware)
      .input({})
      .handler(async (context) => (context as any).user.name);

    const result = await fn({} as any, {});

    expect(result).toBe('Alice');
  });
});

describe('middleware execution', () => {
  it('should pass args through with no middleware', async () => {
    const fn = convex
      .query()
      .input({ name: v.string(), count: v.number() })
      .handler(async (_ctx, args) => ({ name: args.name, count: args.count }));

    const result = await fn({} as any, { name: 'test', count: 42 });

    expect(result).toEqual({ name: 'test', count: 42 });
  });

  it('should enrich context through middleware chain', async () => {
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

  it('should execute middlewares in registration order', async () => {
    const order: string[] = [];
    const first = convex.query().createMiddleware(async (ctx, next) => {
      order.push('first');
      return next(ctx);
    });
    const second = convex.query().createMiddleware(async (ctx, next) => {
      order.push('second');
      return next(ctx);
    });

    const fn = convex
      .query()
      .use(first)
      .use(second)
      .handler(async () => {
        order.push('handler');
      });

    await fn({} as any, {});

    expect(order).toEqual(['first', 'second', 'handler']);
  });

  it('should propagate errors thrown before next()', async () => {
    const failing = convex.query().createMiddleware(async (_ctx, _next) => {
      throw new Error('middleware failed before next');
    });

    const fn = convex
      .query()
      .use(failing)
      .handler(async () => 'should not reach');

    await expect(fn({} as any, {})).rejects.toThrow('middleware failed before next');
  });

  it('should propagate errors thrown after next()', async () => {
    const failsAfter = convex.query().createMiddleware(async (ctx, next) => {
      await next(ctx);
      throw new Error('middleware failed after next');
    });

    const fn = convex
      .query()
      .use(failsAfter)
      .handler(async () => 'handler ran');

    await expect(fn({} as any, {})).rejects.toThrow('middleware failed after next');
  });

  it('should propagate handler error through multiple middleware layers', async () => {
    const order: string[] = [];
    const outer = convex.query().createMiddleware(async (ctx, next) => {
      order.push('outer-before');
      try {
        return await next(ctx);
      } catch (e: any) {
        order.push('outer-catch');
        throw e;
      }
    });
    const inner = convex.query().createMiddleware(async (ctx, next) => {
      order.push('inner-before');
      try {
        return await next(ctx);
      } catch (e: any) {
        order.push('inner-catch');
        throw e;
      }
    });

    const fn = convex
      .query()
      .use(outer)
      .use(inner)
      .handler(async () => {
        throw new Error('boom');
      });

    await expect(fn({} as any, {})).rejects.toThrow('boom');
    expect(order).toEqual(['outer-before', 'inner-before', 'inner-catch', 'outer-catch']);
  });

  it('should work with no middleware at all', async () => {
    const fn = convex.query().handler(async () => 'no middleware');

    const result = await fn({} as any, {});

    expect(result).toBe('no middleware');
  });
});
