// Template source owned by @repo/crpc.
// Edit this file to change generated output.

import { createBuilder, createCrud, operations } from "@repo/crpc";
import { createAdapterFactory } from "better-auth/adapters";
import type { GenericActionCtx, GenericDataModel } from "convex/server";
import { v } from "convex/values";

// @ts-ignore - generated at runtime
import { internal } from "../_generated/api";

type ActionCtx<DataModel extends GenericDataModel = GenericDataModel> = GenericActionCtx<DataModel>;

const serializeValue = (value: any): any => {
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeValue(v)]));
  }
  return value;
};

const stripCreatedAt = (data: Record<string, any>): Record<string, any> => {
  const { createdAt: _createdAt, ...rest } = data;
  return rest;
};

const transformInput = (input: {
  data?: Record<string, any>;
  input?: { data?: Record<string, any> };
}): any => {
  if (input.data) {
    return { ...input, data: serializeValue(stripCreatedAt(input.data)) };
  }
  if (input.input?.data) {
    return {
      ...input,
      input: {
        ...input.input,
        data: serializeValue(stripCreatedAt(input.input.data)),
      },
    };
  }
  return input;
};

const transformWhere = (where: any[] | undefined): any[] | undefined => {
  if (!where || !Array.isArray(where)) return where;
  return where.map((clause: any) => {
    if (clause.field === "createdAt") {
      return { ...clause, field: "_creationTime" };
    }
    if (clause.value instanceof Date) {
      return { ...clause, value: clause.value.getTime() };
    }
    return clause;
  });
};

const whereClauseSchema = v.object({
  connector: v.optional(v.union(v.literal("AND"), v.literal("OR"))),
  field: v.string(),
  operator: v.optional(
    v.union(
      v.literal("contains"),
      v.literal("ends_with"),
      v.literal("eq"),
      v.literal("gt"),
      v.literal("gte"),
      v.literal("in"),
      v.literal("lt"),
      v.literal("lte"),
      v.literal("ne"),
      v.literal("not_in"),
      v.literal("starts_with"),
    ),
  ),
  value: v.any(),
});

const querySchema = v.object({
  limit: v.optional(v.number()),
  model: v.string(),
  offset: v.optional(v.number()),
  op: v.union(v.literal("findOne"), v.literal("findMany"), v.literal("count")),
  select: v.optional(v.array(v.string())),
  sortBy: v.optional(
    v.object({
      direction: v.union(v.literal("asc"), v.literal("desc")),
      field: v.string(),
    }),
  ),
  where: v.optional(v.array(whereClauseSchema)),
});

const mutationSchema = v.object({
  input: v.any(),
  op: v.union(
    v.literal("insert"),
    v.literal("updateOne"),
    v.literal("updateMany"),
    v.literal("remove"),
    v.literal("removeMany"),
  ),
  select: v.optional(v.array(v.string())),
});

function createQueryHandler<DataModel extends GenericDataModel = GenericDataModel>(
  crud: ReturnType<typeof createCrud<DataModel>>,
) {
  return async (ctx: any, args: any) => {
    const where = transformWhere(args.where);
    if (args.op === "findOne") {
      return crud.findOne(ctx, {
        select: args.select,
        table: args.model,
        where,
      });
    }

    if (args.op === "findMany") {
      return crud.findMany(ctx, {
        limit: args.limit,
        offset: args.offset,
        select: args.select,
        sortBy: args.sortBy,
        table: args.model,
        where,
      });
    }

    return crud.count(ctx, {
      table: args.model,
      where,
    });
  };
}

function createMutationHandler<DataModel extends GenericDataModel = GenericDataModel>(
  crud: ReturnType<typeof createCrud<DataModel>>,
) {
  return async (ctx: any, args: any) => {
    if (args.op === "insert") {
      const transformed = transformInput(args.input);
      return crud.create(ctx, {
        data: transformed.data,
        select: args.select,
        table: args.input.model,
      });
    }

    if (args.op === "updateOne") {
      return crud.updateOne(ctx, {
        select: args.select,
        table: args.input.model,
        update: serializeValue(args.input.update),
        where: args.input.where,
      });
    }

    if (args.op === "updateMany") {
      return crud.updateMany(ctx, {
        table: args.input.model,
        update: serializeValue(args.input.update),
        where: args.input.where,
      });
    }

    if (args.op === "remove") {
      return crud.deleteOne(ctx, {
        table: args.input.model,
        where: args.input.where,
      });
    }

    return crud.deleteMany(ctx, {
      table: args.input.model,
      where: args.input.where,
    });
  };
}

const crud = createCrud<any>();
const convex = createBuilder<any>();

export const crpcQuery = convex
  .query()
  .input(querySchema)
  .handler(createQueryHandler(crud))
  .internal();

export const crpcMutation = convex
  .mutation()
  .input(mutationSchema)
  .handler(createMutationHandler(crud))
  .internal();

function createAdapter<DataModel extends GenericDataModel>(ctx: ActionCtx<DataModel>) {
  const adapter = createAdapterFactory({
    adapter: () => ({
      count: async (input) =>
        (await ctx.runQuery(internal._crpc.adapter.crpcQuery, {
          ...input,
          op: "count",
          where: transformWhere(input.where),
        })) as number,
      create: async <T extends Record<string, any>>({
        select,
        ...input
      }: {
        model: string;
        data: T;
        select?: string[];
      }) =>
        (await ctx.runMutation(internal._crpc.adapter.crpcMutation, {
          input: transformInput(input),
          op: "insert",
          select,
        })) as T,
      insert: async <T extends Record<string, any>>({
        select,
        ...input
      }: {
        model: string;
        data: T;
        select?: string[];
      }) =>
        (await ctx.runMutation(internal._crpc.adapter.crpcMutation, {
          input: transformInput(input),
          op: "insert",
          select,
        })) as T,
      delete: async (input: any): Promise<void> => {
        await ctx.runMutation(internal._crpc.adapter.crpcMutation, {
          input: { ...input, where: transformWhere(input.where) },
          op: "remove",
        });
      },
      remove: async (input: any): Promise<void> => {
        await ctx.runMutation(internal._crpc.adapter.crpcMutation, {
          input: { ...input, where: transformWhere(input.where) },
          op: "remove",
        });
      },
      deleteMany: async (input: any): Promise<number> => {
        const deleted = (await ctx.runMutation(internal._crpc.adapter.crpcMutation, {
          input: { ...input, where: transformWhere(input.where) },
          op: "removeMany",
        })) as { count: number };
        return deleted.count;
      },
      findMany: async <T>(input: any): Promise<T[]> =>
        (await ctx.runQuery(internal._crpc.adapter.crpcQuery, {
          ...input,
          op: "findMany",
          where: transformWhere(input.where),
        })) as T[],
      findOne: async <T>(input: any): Promise<T | null> =>
        (await ctx.runQuery(internal._crpc.adapter.crpcQuery, {
          ...input,
          op: "findOne",
          where: transformWhere(input.where),
        })) as T | null,
      update: async <T>(input: {
        model: string;
        where: any;
        update: any;
        select?: string[];
      }): Promise<T | null> =>
        (await ctx.runMutation(internal._crpc.adapter.crpcMutation, {
          input: { ...input, update: serializeValue(input.update) },
          op: "updateOne",
        })) as T | null,
      updateMany: async (input: { model: string; where: any; update: any }): Promise<number> => {
        const updated = (await ctx.runMutation(internal._crpc.adapter.crpcMutation, {
          input: { ...input, update: serializeValue(input.update) },
          op: "updateMany",
        })) as { count: number };
        return updated.count;
      },
    }),
    config: {
      adapterId: "Convex Adapter",
      supportsJSON: true,
      supportsNumericIds: false,
      usePlural: true,
    },
  });

  return adapter;
}

export { createAdapter, mutationSchema, operations, querySchema };
