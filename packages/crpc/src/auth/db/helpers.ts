/**
 * Generic DB helpers for Convex: filtering, sorting, doc normalization.
 * Used by the auth adapter; can be reused by other Convex adapters.
 */

import { withoutSystemFields } from "convex-helpers";
import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { GenericId } from "convex/values";

// --- Types ---

type MaybePromise<T> = T | Promise<T>;
type DbRecord = Record<string, unknown>;

type QueryOrMutationCtx<DataModel extends GenericDataModel> =
  | GenericMutationCtx<DataModel>
  | GenericQueryCtx<DataModel>;

interface Where {
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
  value: Array<number | string> | boolean | number | string | null;
}

interface SortBy {
  direction: "asc" | "desc";
  field: string;
}

// --- Record helpers ---

const isPlainObject = (value: unknown): value is DbRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getDocId = (doc: DbRecord) => (doc._id as GenericId<string> | undefined) ?? doc.id;

const getDocCreatedAt = (doc: DbRecord): number | undefined => {
  const { createdAt } = doc;
  if (typeof createdAt === "number") {
    return createdAt;
  }
  if (typeof doc._creationTime === "number") {
    return doc._creationTime;
  }
  return undefined;
};

/**
 * Converts a Convex document to the shape returned to Better Auth: system fields removed,
 * `id` and `createdAt` set from `_id` and `_creationTime`.
c *
 * Every doc returned by the adapter (findOne, findMany, create, updateOne, deleteOne) goes
 * through this. So on all reads Better Auth receives docs with `createdAt` set from
 * `_creationTime` and has `createdAt` internally—even though we don't store it in the schema.
 *
 * We don't store separate id/createdAt columns; see stripWriteFields.
 *
 * @param doc - Convex document or null
 * @returns Document without system fields, with id and createdAt from _id and _creationTime, or null
 */
const toExternalDoc = (doc: DbRecord | null): DbRecord | null => {
  if (!doc) {
    return null;
  }
  const systemId = doc._id;
  const systemCreatedAt = doc._creationTime;
  const stripped = withoutSystemFields(doc) as DbRecord;
  return { ...stripped, createdAt: systemCreatedAt, id: systemId };
};

const getFieldValue = (doc: DbRecord, field: string): unknown => {
  if (field === "id") {
    return getDocId(doc);
  }
  if (field === "createdAt") {
    return getDocCreatedAt(doc);
  }
  return doc[field];
};

// --- Where / filter ---

const compare = (
  left: unknown,
  operator: NonNullable<Where["operator"]>,
  right: Where["value"],
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
      return Array.isArray(right) && right.includes(left as never);
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case "ne":
      return left !== right;
    case "not_in":
      return Array.isArray(right) && !right.includes(left as never);
    case "starts_with":
      return typeof left === "string" && typeof right === "string" && left.startsWith(right);
    default:
      return false;
  }
};

const matchesWhere = (doc: DbRecord, where: Where[] = []): boolean => {
  if (where.length === 0) {
    return true;
  }
  let current = true;
  for (const [index, clause] of where.entries()) {
    const result = compare(getFieldValue(doc, clause.field), clause.operator ?? "eq", clause.value);
    if (index === 0) {
      current = result;
    } else if (clause.connector === "OR") {
      current = current || result;
    } else {
      current = current && result;
    }
  }
  return current;
};

// --- Select / sort ---

const selectFields = (doc: DbRecord | null, select?: string[]): DbRecord | null => {
  if (!(doc && select && select.length > 0)) {
    return doc;
  }
  const selected: DbRecord = Object.fromEntries(
    select.map((field) => [field, doc[field]]).filter(([, value]) => value !== undefined),
  );
  if (doc.id !== undefined) {
    selected.id = doc.id;
  }
  if (doc.createdAt !== undefined) {
    selected.createdAt = doc.createdAt;
  }
  return selected;
};

const compareValues = (a: unknown, b: unknown): number => {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined) {
    return -1;
  }
  if (b === null || b === undefined) {
    return 1;
  }
  return (a as number | string) > (b as number | string) ? 1 : -1;
};

const sortDocs = (docs: DbRecord[], sortBy?: SortBy): DbRecord[] => {
  if (!sortBy) {
    return docs;
  }
  const direction = sortBy.direction === "asc" ? 1 : -1;
  return [...docs].sort((left, right) => {
    const leftValue = getFieldValue(left, sortBy.field);
    const rightValue = getFieldValue(right, sortBy.field);
    return compareValues(leftValue, rightValue) * direction;
  });
};

// --- Write helpers ---

/**
 * Strips the write fields from the data.
 * We don’t store the Better Auth system fields in the database, so we need to strip them.
 *
 * @param data - The data to strip the write fields from.
 * @returns The data without the write fields.
 */
const stripWriteFields = (data: DbRecord): DbRecord => {
  const { _creationTime: _1, _id: _2, id: _3, createdAt: _4, ...rest } = data;
  return rest;
};

const normalizeWriteData = (data: DbRecord): DbRecord => {
  const normalized = stripWriteFields(data);
  return Object.fromEntries(
    Object.entries(normalized).map(([key, value]) => [
      key,
      value instanceof Date ? value.getTime() : value,
    ]),
  ) as DbRecord;
};

type GenericCtx<DataModel extends GenericDataModel = GenericDataModel> =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>
  | GenericActionCtx<DataModel>;

const isActionCtx = <DataModel extends GenericDataModel>(
  ctx: GenericCtx<DataModel>,
): ctx is GenericActionCtx<DataModel> => "runAction" in ctx;

/**
 * Asserts the context is an action context (has runAction, runMutation, runQuery). Use it in auth
 * definition or plugins when you need runMutation/runQuery from an action-only path.
 *
 * @typeParam DataModel - Convex data model
 * @param ctx - Query, mutation, or action context
 * @returns The same context typed as ActionCtx
 * @throws Error when ctx is not an action context
 *
 * @example
 * ```typescript
 * plugins: [
 *   convex({ provider: [betterAuth], ... }),
 *   emailOTP({
 *     async sendVerificationOTP({ type }) {
 *       const ctx = requireActionCtx(myCtx);
 *       await ctx.runMutation(internal.sendEmail, { type });
 *     },
 *   }),
 * ],
 * ```
 */
const requireActionCtx = <DataModel extends GenericDataModel>(
  ctx: GenericCtx<DataModel>,
): GenericActionCtx<DataModel> => {
  if (!isActionCtx(ctx)) {
    throw new Error("Action context required");
  }
  return ctx;
};

export {
  isPlainObject,
  matchesWhere,
  normalizeWriteData,
  requireActionCtx,
  selectFields,
  sortDocs,
  stripWriteFields,
  toExternalDoc,
};
export type { MaybePromise, DbRecord, QueryOrMutationCtx, Where, SortBy };
