import { GenericDataModel, GenericMutationCtx, GenericQueryCtx } from "convex/server";

import { selectFields } from "../internal/select-fields";
import type {
  CreateInput,
  DeleteManyInput,
  DeleteOneInput,
  FindManyInput,
  FindOneInput,
  UpdateManyInput,
  UpdateOneInput,
} from "./operations";
import { Repository } from "./repository";

type Row = Record<string, unknown>;
type Ctx<DataModel extends GenericDataModel = GenericDataModel> =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>;

function createCrud<DataModel extends GenericDataModel = GenericDataModel>() {
  const repo = new Repository<DataModel>();

  return {
    async create(ctx: GenericMutationCtx<DataModel>, input: CreateInput): Promise<Row> {
      const created = await repo.create(ctx, input);
      return selectFields(created, input.select) as Row;
    },

    async findOne(ctx: Ctx<DataModel>, input: FindOneInput): Promise<Row | null> {
      const row = await repo.findOne(ctx, input);
      return selectFields(row, input.select) as Row | null;
    },

    async findMany(ctx: Ctx<DataModel>, input: FindManyInput): Promise<Row[]> {
      const rows = await repo.findMany(ctx, input);
      return rows.map((row) => selectFields(row, input.select) as Row);
    },

    async updateOne(
      ctx: GenericMutationCtx<DataModel>,
      input: UpdateOneInput,
    ): Promise<Row | null> {
      const updated = await repo.updateOne(ctx, input);
      return selectFields(updated, input.select) as Row | null;
    },

    updateMany(ctx: GenericMutationCtx<DataModel>, input: UpdateManyInput) {
      return repo.updateMany(ctx, input);
    },

    deleteOne(ctx: GenericMutationCtx<DataModel>, input: DeleteOneInput) {
      return repo.deleteOne(ctx, input);
    },

    deleteMany(ctx: GenericMutationCtx<DataModel>, input: DeleteManyInput) {
      return repo.deleteMany(ctx, input);
    },

    count(ctx: Ctx<DataModel>, input: { table: string; where?: FindManyInput["where"] }) {
      return repo.count(ctx, input);
    },
  };
}

export { createCrud };
