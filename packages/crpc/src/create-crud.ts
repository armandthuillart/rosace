import {
  GenericDataModel,
  GenericDocument,
  GenericMutationCtx,
  GenericQueryCtx,
  SystemFields,
} from "convex/server";
import { withoutSystemFields } from "convex-helpers";
import { GenericId } from "convex/values";

type Row = Record<string, unknown>;
type Doc = GenericDocument & SystemFields & { _id: GenericId<string> };

type Ctx<DataModel extends GenericDataModel = GenericDataModel> =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>;

type Mode = "one" | "many";
type Order = { direction: "asc" | "desc"; field: string };
type Where = {
  connector?: "AND" | "OR";
  field: string;
  operator?:
    | "contains"
    | "ends_with"
    | "eq"
    | "gt"
    | "gte"
    | "in"
    | "lt"
    | "lte"
    | "ne"
    | "not_in"
    | "starts_with";
  value: unknown;
};

type CreateInput = {
  table: string;
  data: Row;
  select?: string[];
};

type ReadInput = {
  mode: Mode;
  table: string;
  where?: Where[];
  order?: Order;
  limit?: number;
  offset?: number;
  select?: string[];
};

type UpdateInput = {
  mode: Mode;
  table: string;
  where?: Where[];
  data: Row;
  select?: string[];
};

type RemoveInput = {
  mode: Mode;
  table: string;
  where?: Where[];
};

const toRow = (doc: Doc | null): Row | null => {
  if (!doc) {
    return null;
  }

  return {
    ...withoutSystemFields(doc),
    id: doc._id,
    createdAt: doc._creationTime,
  };
};

const normalize = (doc: Doc): Row => {
  const base = withoutSystemFields(doc) as Row;
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      value instanceof Date ? value.getTime() : value,
    ]),
  );
};

const getField = (doc: Row, key: string): unknown => {
  if (key === "id") return doc.id ?? doc._id;
  if (key === "createdAt") return doc.createdAt ?? doc._creationTime;
  return doc[key];
};

const matches = (
  left: unknown,
  operator: NonNullable<Where["operator"]>,
  right: unknown,
): boolean => {
  switch (operator) {
    case "contains":
      return typeof left === "string" && typeof right === "string" && left.includes(right);
    case "ends_with":
      return typeof left === "string" && typeof right === "string" && left.endsWith(right);
    case "eq":
      return left === right;
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "in":
      return Array.isArray(right) && right.includes(left);
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case "ne":
      return left !== right;
    case "not_in":
      return Array.isArray(right) && !right.includes(left);
    case "starts_with":
      return typeof left === "string" && typeof right === "string" && left.startsWith(right);
  }
};

const where = (doc: Row, clauses: Where[] = []): boolean => {
  let result = true;

  for (const [index, clause] of clauses.entries()) {
    const current = matches(getField(doc, clause.field), clause.operator ?? "eq", clause.value);

    result =
      index === 0 ? current : clause.connector === "OR" ? result || current : result && current;
  }

  return result;
};

const orderBy = (docs: Row[], order?: Order): Row[] => {
  if (!order) return docs;

  const direction = order.direction === "asc" ? 1 : -1;

  return [...docs].sort((left, right) => {
    const a = getField(left, order.field);
    const b = getField(right, order.field);

    if (a === b) return 0;
    if (a == null) return -1 * direction;
    if (b == null) return 1 * direction;

    return ((a as string | number) > (b as string | number) ? 1 : -1) * direction;
  });
};
const pick = (doc: Row | null, fields?: string[]): Row | null => {
  if (!doc || !fields?.length) return doc;

  const selected = Object.fromEntries(
    fields.map((field) => [field, doc[field]]).filter(([, v]) => v !== undefined),
  );

  if (doc.id !== undefined) selected.id = doc.id;
  if (doc.createdAt !== undefined) selected.createdAt = doc.createdAt;

  return selected;
};

function createCRUD<DataModel extends GenericDataModel = GenericDataModel>() {
  async function create(ctx: GenericMutationCtx<DataModel>, input: CreateInput): Promise<Row> {
    const id = await ctx.db.insert(input.table, normalize(input.data as Doc));
    const created = await ctx.db.get(id);

    if (!created) throw new Error(`Failed to create document '${input.table}'.`);

    return pick(toRow(created), input.select) as Row;
  }

  async function read(ctx: Ctx<DataModel>, input: ReadInput): Promise<Row | Row[] | null> {
    const docs = await ctx.db.query(input.table).collect();

    const filtered = orderBy(
      docs.filter((doc) => where(doc, input.where)),
      input.order,
    );

    const rows = filtered
      .slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? filtered.length))
      .map(toRow)
      .filter((doc): doc is Row => doc !== null);

    return input.mode === "many" ? rows : pick(rows[0] ?? null, input.select);
  }

  async function update(
    ctx: GenericMutationCtx<DataModel>,
    input: UpdateInput,
  ): Promise<Row | { count: number; ids: string[] } | null> {
    const matches = (await read(ctx, {
      mode: "many",
      table: input.table,
      where: input.where,
    })) as Row[];

    const ids: string[] = [];

    for (const match of matches) {
      const id = match.id as GenericId<string>;
      await ctx.db.patch(id, stripSystemFields(normalize(input.data as Doc) as Doc));
      ids.push(id);
    }

    if (input.mode === "many") return { count: ids.length, ids };
    if (ids.length === 0) return null;

    return await read(ctx, {
      mode: "one",
      table: input.table,
      where: [{ field: "id", operator: "eq", value: ids[0] }],
      select: input.select,
    });
  }

  async function remove(
    ctx: GenericMutationCtx<DataModel>,
    input: RemoveInput,
  ): Promise<Row | { count: number; ids: string[] } | null> {
    const matches = (await read(ctx, {
      mode: "many",
      table: input.table,
      where: input.where,
    })) as Row[];

    if (input.mode === "one") {
      const first = matches[0];
      if (!first) return null;
      await ctx.db.delete(first.id as GenericId<string>);
      return first;
    }

    const ids: string[] = [];

    for (const match of matches) {
      await ctx.db.delete(match.id as GenericId<string>);
      ids.push(match.id as string);
    }

    return { count: ids.length, ids };
  }

  return { create, read, update, remove };
}

export { createCRUD };
