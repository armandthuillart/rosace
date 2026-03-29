import type {
  GenericDataModel,
  GenericMutationCtx,
  GenericSchema,
  SchemaDefinition,
} from "convex/server";
import type { GenericId } from "convex/values";
import type {
  GenericAuthBeforeResult,
  GenericAuthTriggerChange,
  GenericAuthTriggers,
} from "@repo/better-auth/server";
import {
  type DbRecord,
  isPlainObject,
  type MaybePromise,
  matchesWhere,
  normalizeWriteData,
  type QueryOrMutationCtx,
  type SortBy,
  selectFields,
  sortDocs,
  stripWriteFields,
  toExternalDoc,
  type Where,
} from "./helpers";

type AuthModel = "account" | "session" | "user" | "verification";

interface RuntimeTableTriggers<TriggerCtx> {
  change?: (change: GenericAuthTriggerChange<DbRecord>, ctx: TriggerCtx) => MaybePromise<void>;
  create?: {
    after?: (doc: DbRecord, ctx: TriggerCtx) => MaybePromise<void>;
    before?: (data: DbRecord, ctx: TriggerCtx) => MaybePromise<GenericAuthBeforeResult<DbRecord>>;
  };
  delete?: {
    after?: (doc: DbRecord, ctx: TriggerCtx) => MaybePromise<void>;
    before?: (doc: DbRecord, ctx: TriggerCtx) => MaybePromise<GenericAuthBeforeResult<DbRecord>>;
  };
  update?: {
    after?: (doc: DbRecord, ctx: TriggerCtx) => MaybePromise<void>;
    before?: (update: DbRecord, ctx: TriggerCtx) => MaybePromise<GenericAuthBeforeResult<DbRecord>>;
  };
}

const AUTH_MODELS = new Set<AuthModel>(["account", "session", "user", "verification"]);

const AUTH_TRIGGER_KEYS = new Set(["change", "create", "delete", "update"]);

class TriggerCancelledError extends Error {
  readonly tableName: string;
  readonly operation: "create" | "delete" | "update";

  constructor(tableName: string, operation: "create" | "delete" | "update") {
    super(`Trigger cancelled ${operation} on '${tableName}'.`);
    this.name = "TriggerCancelledError";
    this.tableName = tableName;
    this.operation = operation;
  }
}

/**
 * Gets the auth model from the model name.
 *
 * @param model - The model name.
 * @returns The auth model.
 */
const getAuthModel = (model: string): AuthModel => {
  if (!AUTH_MODELS.has(model as AuthModel)) {
    throw new Error(`Unsupported Better Auth model '${model}'.`);
  }
  return model as AuthModel;
};

/**
 * Ensures the runtime table triggers are valid.
 *
 * @typeParam DataModel - The data model type.
 * @typeParam Schema - The schema type.
 * @typeParam TriggerCtx - The trigger context type.
 * @param model - The model name.
 * @param triggers - The triggers.
 * @returns The runtime table triggers.
 */
const ensureRuntimeTableTriggers = <
  DataModel extends GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true>,
  TriggerCtx,
>(
  model: string,
  triggers: GenericAuthTriggers<DataModel, Schema, TriggerCtx> | undefined,
): RuntimeTableTriggers<TriggerCtx> | undefined => {
  const tableTriggers = triggers?.[model as keyof typeof triggers];

  if (!tableTriggers) {
    return;
  }

  if (!isPlainObject(tableTriggers)) {
    throw new Error(
      `Invalid auth triggers for '${model}'. Expected object with create/update/delete/change keys.`,
    );
  }

  for (const key of Object.keys(tableTriggers)) {
    if (!AUTH_TRIGGER_KEYS.has(key)) {
      throw new Error(
        `Invalid auth trigger key '${key}' for '${model}'. Allowed: create, update, delete, change.`,
      );
    }
  }

  return tableTriggers as RuntimeTableTriggers<TriggerCtx>;
};

/**
 * Applies the before hook to the input data.
 *
 * @typeParam TriggerCtx - The trigger context type.
 * @param options - The options for the applyBefore function.
 * @returns The input data after the before hook is applied.
 */
const applyBefore = async <TriggerCtx>(options: {
  ctx: TriggerCtx;
  hook:
    | ((input: DbRecord, ctx: TriggerCtx) => MaybePromise<GenericAuthBeforeResult<DbRecord>>)
    | undefined;
  input: DbRecord;
  model: string;
  operation: "create" | "delete" | "update";
}): Promise<DbRecord> => {
  const { ctx, hook, input, model, operation } = options;

  if (!hook) {
    return input;
  }

  const result = await hook(input, ctx);

  if (result === false) {
    throw new TriggerCancelledError(model, operation);
  }

  if (isPlainObject(result) && isPlainObject(result.data)) {
    return { ...input, ...result.data };
  }

  return input;
};

/**
 * Provides CRUD operations and trigger hooks for the auth tables.
 *
 * @returns Adapter object containing CRUD methods (create, findOne, findMany, updateOne, updateMany, deleteOne, deleteMany) with integrated trigger hooks.
 *
 * @internal
 */
const createAdapter = <
  DataModel extends GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true>,
  TriggerCtx,
>(config: {
  getTriggers: (
    ctx: QueryOrMutationCtx<DataModel>,
  ) => GenericAuthTriggers<DataModel, Schema, TriggerCtx> | undefined;
}) => {
  const getTableTriggers = (ctx: QueryOrMutationCtx<DataModel>, model: string) =>
    ensureRuntimeTableTriggers(model, config.getTriggers(ctx));

  const findMany = async (
    ctx: QueryOrMutationCtx<DataModel>,
    args: {
      limit?: number;
      model: string;
      offset?: number;
      sortBy?: SortBy;
      where?: Where[];
    },
  ) => {
    const model = getAuthModel(args.model);
    const docs = await ctx.db.query(model).collect();

    const filtered = sortDocs(
      docs.filter((d) => matchesWhere(d as DbRecord, args.where)),
      args.sortBy,
    );

    const offset = args.offset ?? 0;
    const limit = args.limit ?? filtered.length;
    const sliced = filtered.slice(offset, offset + limit);

    return sliced
      .map((doc: DbRecord) => toExternalDoc(doc))
      .filter((doc: DbRecord | null): doc is DbRecord => doc !== null);
  };

  const findOne = async (
    ctx: QueryOrMutationCtx<DataModel>,
    args: { model: string; select?: string[]; where?: Where[] },
  ) => {
    const docs = await findMany(ctx, {
      ...args,
      limit: 1,
    });

    return selectFields(docs[0] ?? null, args.select);
  };

  const create = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { data: DbRecord; model: string; select?: string[] },
  ) => {
    const model = getAuthModel(args.model);
    const triggers = getTableTriggers(ctx, model);
    const triggerCtx = ctx as unknown as TriggerCtx;

    const prepared = await applyBefore({
      ctx: triggerCtx,
      hook: triggers?.create?.before,
      input: args.data,
      model,
      operation: "create",
    });

    const id = await ctx.db.insert(model, normalizeWriteData(prepared) as never);

    const raw = (await ctx.db.get(id)) as DbRecord | null;

    if (!raw) {
      throw new Error(`Failed to load created auth document '${args.model}'.`);
    }

    const created = toExternalDoc(raw) as DbRecord;

    await triggers?.create?.after?.(created, triggerCtx);

    await triggers?.change?.(
      { id: created.id, newDoc: created, oldDoc: null, operation: "insert" },
      triggerCtx,
    );

    return selectFields(created, args.select);
  };

  const updateMany = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { model: string; update: DbRecord; where?: Where[] },
  ) => {
    const model = getAuthModel(args.model);
    const matches = await findMany(ctx, { model, where: args.where });
    const triggers = getTableTriggers(ctx, model);
    const triggerCtx = ctx as unknown as TriggerCtx;

    const results = await Promise.all(
      matches.map(async (match: DbRecord): Promise<GenericId<string> | null> => {
        const patched = await applyBefore({
          ctx: triggerCtx,
          hook: triggers?.update?.before,
          input: args.update,
          model,
          operation: "update",
        });

        const id = match.id as GenericId<string>;

        await ctx.db.patch(id, stripWriteFields(normalizeWriteData(patched)) as never);

        const raw = (await ctx.db.get(id)) as DbRecord | null;

        if (!raw) {
          return null;
        }

        const newDoc = toExternalDoc(raw) as DbRecord;

        await triggers?.update?.after?.(newDoc, triggerCtx);

        await triggers?.change?.(
          { id: newDoc.id, newDoc, oldDoc: match, operation: "update" },
          triggerCtx,
        );

        return newDoc.id as GenericId<string>;
      }),
    );

    const ids = results.filter(
      (id: GenericId<string> | null): id is GenericId<string> => id !== null,
    );

    return { count: ids.length, ids };
  };

  const updateOne = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { model: string; update: DbRecord; where?: Where[] },
  ) => {
    const result = await updateMany(ctx, args);

    if (result.ids.length === 0) {
      return null;
    }

    return findOne(ctx, {
      model: args.model,
      where: [{ field: "id", operator: "eq", value: result.ids[0] as string }],
    });
  };

  const deleteMany = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { model: string; where?: Where[] },
  ) => {
    const model = getAuthModel(args.model);
    const triggers = getTableTriggers(ctx, model);
    const triggerCtx = ctx as unknown as TriggerCtx;
    const matches = await findMany(ctx, { model, where: args.where });

    const ids = await Promise.all(
      matches.map(async (match: DbRecord) => {
        await applyBefore({
          ctx: triggerCtx,
          hook: triggers?.delete?.before,
          input: match,
          model,
          operation: "delete",
        });

        await ctx.db.delete(match.id as GenericId<string>);

        await triggers?.delete?.after?.(match, triggerCtx);

        await triggers?.change?.(
          { id: match.id, newDoc: null, oldDoc: match, operation: "delete" },
          triggerCtx,
        );

        return match.id;
      }),
    );

    return { count: ids.length, ids };
  };

  const deleteOne = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { model: string; where?: Where[] },
  ) => {
    const match = await findOne(ctx, args);

    if (!match) {
      return null;
    }

    await deleteMany(ctx, {
      model: args.model,
      where: [{ field: "id", operator: "eq", value: match.id as string }],
    });

    return match;
  };

  return {
    create,
    deleteMany,
    deleteOne,
    findMany,
    findOne,
    updateMany,
    updateOne,
  };
};

export { createAdapter };
