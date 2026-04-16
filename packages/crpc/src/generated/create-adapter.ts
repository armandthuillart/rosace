import { createAdapterFactory } from "better-auth/adapters";
import { createCRUD } from "../create-crud";
import { createBuilder } from "..";

import { v } from "convex/values";
import {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";

type QueryCtx<DataModel extends GenericDataModel = GenericDataModel> = GenericQueryCtx<DataModel>;
type ActionCtx<DataModel extends GenericDataModel = GenericDataModel> = GenericActionCtx<DataModel>;
type MutationCtx<DataModel extends GenericDataModel = GenericDataModel> =
  GenericMutationCtx<DataModel>;

type GenericCtx<DataModel extends GenericDataModel = GenericDataModel> =
  | QueryCtx<DataModel>
  | MutationCtx<DataModel>
  | ActionCtx<DataModel>;

const querySchema = v.object({
  limit: v.optional(v.number()),
  model: v.string(),
  offset: v.optional(v.number()),
  op: v.union(v.literal("findOne"), v.literal("findMany")),
  select: v.optional(v.array(v.string())),
  sortBy: v.optional(
    v.object({
      direction: v.union(v.literal("asc"), v.literal("desc")),
      field: v.string(),
    }),
  ),
  where: v.optional(v.array(v.any())),
});

const mutationSchema = v.object({
  input: v.any(),
  op: v.union(
    v.literal("create"),
    v.literal("updateOne"),
    v.literal("updateMany"),
    v.literal("deleteOne"),
    v.literal("deleteMany"),
  ),
  select: v.optional(v.array(v.string())),
});

function createAdapter<DataModel extends GenericDataModel>(ctx: ActionCtx<DataModel>) {
  const { create, read, update, remove } = createCRUD();

  const adapter = createAdapterFactory({
    adapter: () => {
      const convex = createBuilder<DataModel>();

      const query = convex
        .query()
        .input(querySchema)
        .handler(async (ctx, args) => {
          switch (args.op) {
            case "findOne":
              return await read(ctx, {
                mode: "one",
                table: args.model,
                where: args.where,
                select: args.select,
              });
            case "findMany":
              return await read(ctx, {
                mode: "many",
                table: args.model,
                where: args.where,
                order: args.sortBy,
                limit: args.limit,
                offset: args.offset,
              });
          }
        });

      const mutate = convex
        .mutation()
        .input(mutationSchema)
        .handler(async (ctx, args) => {
          switch (args.op) {
            case "create":
              return await create(ctx, {
                table: args.input.model,
                data: args.input.data,
                select: args.select,
              });
            case "updateOne":
              return await update(ctx, {
                mode: "one",
                table: args.input.model,
                where: args.input.where,
                data: args.input.update,
                select: args.select,
              });
            case "updateMany":
              return await update(ctx, {
                mode: "many",
                table: args.input.model,
                where: args.input.where,
                data: args.input.update,
              });
            case "deleteOne":
              return await remove(ctx, {
                mode: "one",
                table: args.input.model,
                where: args.input.where,
              });
            case "deleteMany":
              return await remove(ctx, {
                mode: "many",
                table: args.input.model,
                where: args.input.where,
              });
          }
        });

      return {
        count: async (input) => {
          const items = await query(ctx, {
            ...input,
            op: "findMany",
          });

          return items.length;
        },
        create: async ({ select, ...input }) =>
          await mutate(ctx, {
            input,
            op: "create",
            select,
          }),
        delete: async (input) =>
          await mutate(ctx, {
            input,
            op: "deleteOne",
          }),
        deleteMany: async (input) => {
          const deleted = await mutate(ctx, {
            input,
            op: "deleteMany",
          });

          return deleted.count;
        },
        findOne: async (input) =>
          await query(ctx, {
            ...input,
            op: "findOne",
          }),
        findMany: async (input) =>
          await query(ctx, {
            ...input,
            op: "findMany",
          }),
        update: async (input) =>
          await mutate(ctx, {
            input,
            op: "updateOne",
          }),
        updateMany: async (input) => {
          const updated = await mutate(ctx, {
            input,
            op: "updateMany",
          });

          return updated.count;
        },
      };
    },
    config: {
      adapterId: "Convex Adapter",
      supportsJSON: true,
      supportsNumericIds: false,
      usePlural: true,
    },
  });

  return adapter;
}

export { createAdapter };
