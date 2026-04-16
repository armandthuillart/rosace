import { withoutSystemFields } from "convex-helpers";
import {
  GenericDataModel,
  GenericDocument,
  GenericMutationCtx,
  GenericQueryCtx,
  SystemFields,
} from "convex/server";
import { GenericId } from "convex/values";

import type {
  CountInput,
  CreateInput,
  DeleteManyInput,
  DeleteOneInput,
  FindManyInput,
  FindOneInput,
  Operator,
  Sort,
  UpdateManyInput,
  UpdateOneInput,
  Where,
} from "./operations";

type Row = Record<string, unknown>;
type Doc = GenericDocument & Partial<SystemFields> & { _id?: GenericId<string> };
type Ctx<DataModel extends GenericDataModel = GenericDataModel> =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>;
type PaginateResult<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string;
};

const stripSystemFields = (doc: Row): Row => {
  const { _id, _creationTime, id: _legacyId, createdAt: _legacyCreatedAt, ...rest } = doc;
  return rest;
};

const toRow = (doc: Row | null): Row | null => {
  if (!doc) return null;

  return {
    ...stripSystemFields(withoutSystemFields(doc as Doc) as Row),
    createdAt: doc._creationTime,
    id: doc._id,
  };
};

const normalize = (doc: Row): Row =>
  Object.fromEntries(
    Object.entries(stripSystemFields(doc)).map(([key, value]) => [
      key,
      value instanceof Date ? value.getTime() : value,
    ]),
  );

function validateSort(sortBy?: Sort) {
  if (!sortBy) return;
  if (sortBy.field !== "createdAt") {
    throw new Error("Only createdAt sorting is supported.");
  }
}

function assertSupportedOperator(operator: Operator, field: string) {
  if (operator === "contains" || operator === "starts_with" || operator === "ends_with") {
    throw new Error(
      `Operator '${operator}' is not supported for DB-first queries on field '${field}'.`,
    );
  }
}

function applySimpleOperator(queryBuilder: any, field: any, operator: Operator, value: unknown) {
  switch (operator) {
    case "eq":
      return queryBuilder.eq(field, value);
    case "ne":
      return queryBuilder.neq(field, value);
    case "gt":
      return queryBuilder.gt(field, value);
    case "gte":
      return queryBuilder.gte(field, value);
    case "lt":
      return queryBuilder.lt(field, value);
    case "lte":
      return queryBuilder.lte(field, value);
    default:
      return null;
  }
}

function applyInOperator(queryBuilder: any, field: any, value: unknown, negate: boolean) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Operator '${negate ? "not_in" : "in"}' requires a non-empty array value.`);
  }

  const terms = value.map((item) => queryBuilder.eq(field, item));
  const combined = terms.slice(1).reduce((acc, term) => queryBuilder.or(acc, term), terms[0]);
  return negate ? queryBuilder.not(combined) : combined;
}

function applyWhere<DataModel extends GenericDataModel>(
  query: ReturnType<GenericQueryCtx<DataModel>["db"]["query"]>,
  where?: Where[],
) {
  if (!where?.length) return query;

  return query.filter((q) => {
    const terms = where.map((clause) => {
      const operator = clause.operator ?? "eq";
      assertSupportedOperator(operator, clause.field);

      const fieldName = clause.field === "id" ? "_id" : clause.field;
      const field = q.field(fieldName);
      const simple = applySimpleOperator(q, field, operator, clause.value);
      if (simple) return simple;

      switch (operator) {
        case "in":
          return applyInOperator(q, field, clause.value, false);
        case "not_in":
          return applyInOperator(q, field, clause.value, true);
        default:
          throw new Error(`Operator '${operator}' is not supported.`);
      }
    });

    return terms.slice(1).reduce((acc, term, index) => {
      const termIndex = index + 1;
      const connector = where[termIndex]?.connector ?? where[termIndex - 1]?.connector ?? "AND";
      return connector === "OR" ? q.or(acc, term) : q.and(acc, term);
    }, terms[0]);
  });
}

function buildQuery<DataModel extends GenericDataModel>(
  ctx: Ctx<DataModel>,
  input: { table: string; where?: Where[]; sortBy?: Sort },
) {
  validateSort(input.sortBy);

  const query = applyWhere(ctx.db.query(input.table), input.where) as any;
  return input.sortBy?.field === "createdAt" ? query.order(input.sortBy.direction) : query;
}

async function paginateRows(
  query: any,
  options: { offset?: number; limit?: number; pageSize?: number },
): Promise<Row[]> {
  const offset = Math.max(0, options.offset ?? 0);
  const pageSize = Math.max(1, options.pageSize ?? 100);
  const target = options.limit === undefined ? Infinity : Math.max(0, options.limit);

  if (target === 0) return [];

  const rows: Row[] = [];
  let cursor: string | null = null;
  let skipped = 0;

  while (true) {
    const result = (await query.paginate({
      cursor,
      numItems: pageSize,
    })) as PaginateResult<Row>;
    cursor = result.continueCursor;

    for (const doc of result.page) {
      if (skipped < offset) {
        skipped += 1;
        continue;
      }
      const row = toRow(doc as Row);
      if (!row) continue;
      rows.push(row);
      if (rows.length >= target) return rows;
    }

    if (result.isDone) return rows;
  }
}

async function paginateCount(query: any): Promise<number> {
  const pageSize = 250;
  let cursor: string | null = null;
  let total = 0;

  while (true) {
    const result = (await query.paginate({
      cursor,
      numItems: pageSize,
    })) as PaginateResult<Row>;
    total += result.page.length;
    if (result.isDone) return total;
    cursor = result.continueCursor;
  }
}

class Repository<DataModel extends GenericDataModel = GenericDataModel> {
  async create(ctx: GenericMutationCtx<DataModel>, input: CreateInput): Promise<Row> {
    const table = input.table as Parameters<typeof ctx.db.insert>[0];
    const payload = normalize(input.data as Doc) as Parameters<typeof ctx.db.insert>[1];
    const id = await ctx.db.insert(table, payload);
    const created = await ctx.db.get(id);

    if (!created) throw new Error(`Failed to create document '${input.table}'.`);

    return toRow(created as Row) as Row;
  }

  async findOne(ctx: Ctx<DataModel>, input: FindOneInput): Promise<Row | null> {
    const query = buildQuery(ctx, {
      table: input.table,
      where: input.where,
    });
    const rows = await paginateRows(query, { limit: 1, pageSize: 1 });
    return rows[0] ?? null;
  }

  async findMany(ctx: Ctx<DataModel>, input: FindManyInput): Promise<Row[]> {
    const query = buildQuery(ctx, input);
    return paginateRows(query, {
      offset: input.offset,
      limit: input.limit,
    });
  }

  async updateOne(ctx: GenericMutationCtx<DataModel>, input: UpdateOneInput): Promise<Row | null> {
    const match = await this.findOne(ctx, {
      table: input.table,
      where: input.where,
    });
    if (!match?.id) return null;

    await ctx.db.patch(match.id as GenericId<string>, normalize(input.update) as any);
    const updated = await ctx.db.get(match.id as GenericId<string>);
    return toRow(updated as Row);
  }

  async updateMany(
    ctx: GenericMutationCtx<DataModel>,
    input: UpdateManyInput,
  ): Promise<{ count: number; ids: string[] }> {
    const matches = await this.findMany(ctx, {
      table: input.table,
      where: input.where,
    });

    const ids: string[] = [];
    for (const match of matches) {
      if (!match.id) continue;
      await ctx.db.patch(match.id as GenericId<string>, normalize(input.update) as any);
      ids.push(match.id as string);
    }

    return { count: ids.length, ids };
  }

  async deleteOne(ctx: GenericMutationCtx<DataModel>, input: DeleteOneInput): Promise<Row | null> {
    const first = await this.findOne(ctx, {
      table: input.table,
      where: input.where,
    });
    if (!first?.id) return null;

    await ctx.db.delete(first.id as GenericId<string>);
    return first;
  }

  async deleteMany(
    ctx: GenericMutationCtx<DataModel>,
    input: DeleteManyInput,
  ): Promise<{ count: number; ids: string[] }> {
    const matches = await this.findMany(ctx, {
      table: input.table,
      where: input.where,
    });

    const ids: string[] = [];
    for (const match of matches) {
      if (!match.id) continue;
      await ctx.db.delete(match.id as GenericId<string>);
      ids.push(match.id as string);
    }

    return { count: ids.length, ids };
  }

  async count(ctx: Ctx<DataModel>, input: CountInput): Promise<number> {
    const query = buildQuery(ctx, {
      table: input.table,
      where: input.where,
    });
    return paginateCount(query);
  }
}

export { Repository };
