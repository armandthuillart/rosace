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
} from "../../../../better-auth/old-src/server";
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

const ADAPTER_LOG_PREFIX = "[crpc-auth-db-adapter]";

const logAdapter = (message: string, details?: Record<string, unknown>) => {
  if (details) {
    console.log(`${ADAPTER_LOG_PREFIX} ${message}`, details);
    return;
  }
  console.log(`${ADAPTER_LOG_PREFIX} ${message}`);
};

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

const getAuthModel = (model: string): AuthModel => {
  logAdapter("getAuthModel:start", { model });
  if (!AUTH_MODELS.has(model as AuthModel)) {
    logAdapter("getAuthModel:unsupported-model", { model });
    throw new Error(`Unsupported Better Auth model '${model}'.`);
  }
  logAdapter("getAuthModel:success", { model });
  return model as AuthModel;
};

const ensureRuntimeTableTriggers = <
  DataModel extends GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true>,
  TriggerCtx,
>(
  model: string,
  triggers: GenericAuthTriggers<DataModel, Schema, TriggerCtx> | undefined,
): RuntimeTableTriggers<TriggerCtx> | undefined => {
  logAdapter("ensureRuntimeTableTriggers:start", { model, hasTriggers: Boolean(triggers) });
  const tableTriggers = triggers?.[model as keyof typeof triggers];

  if (!tableTriggers) {
    logAdapter("ensureRuntimeTableTriggers:no-table-triggers", { model });
    return;
  }

  if (!isPlainObject(tableTriggers)) {
    logAdapter("ensureRuntimeTableTriggers:invalid-shape", {
      model,
      actualType: typeof tableTriggers,
    });
    throw new Error(
      `Invalid auth triggers for '${model}'. Expected object with create/update/delete/change keys.`,
    );
  }

  for (const key of Object.keys(tableTriggers)) {
    if (!AUTH_TRIGGER_KEYS.has(key)) {
      logAdapter("ensureRuntimeTableTriggers:invalid-key", { model, key });
      throw new Error(
        `Invalid auth trigger key '${key}' for '${model}'. Allowed: create, update, delete, change.`,
      );
    }
  }

  logAdapter("ensureRuntimeTableTriggers:success", {
    model,
    keys: Object.keys(tableTriggers),
  });
  return tableTriggers as RuntimeTableTriggers<TriggerCtx>;
};

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
  logAdapter("applyBefore:start", {
    model,
    operation,
    hasHook: Boolean(hook),
    hasCtx: Boolean(ctx),
  });

  if (!hook) {
    logAdapter("applyBefore:skip-no-hook", { model, operation });
    return input;
  }

  const result = await hook(input, ctx);
  logAdapter("applyBefore:hook-result", {
    model,
    operation,
    cancelled: result === false,
    mergedData: Boolean(isPlainObject(result) && isPlainObject(result.data)),
  });

  if (result === false) {
    logAdapter("applyBefore:cancelled", { model, operation });
    throw new TriggerCancelledError(model, operation);
  }

  if (isPlainObject(result) && isPlainObject(result.data)) {
    logAdapter("applyBefore:merged", {
      model,
      operation,
      mergedKeys: Object.keys(result.data),
    });
    return { ...input, ...result.data };
  }

  logAdapter("applyBefore:return-input", { model, operation });
  return input;
};

const createAdapter = <
  DataModel extends GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true>,
  TriggerCtx,
>(config: {
  getTriggers: (
    ctx: QueryOrMutationCtx<DataModel>,
  ) => GenericAuthTriggers<DataModel, Schema, TriggerCtx> | undefined;
}) => {
  logAdapter("createAdapter:init");
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
    logAdapter("findMany:start", { model: args.model, whereCount: args.where?.length ?? 0 });
    const model = getAuthModel(args.model);
    const docs = await ctx.db.query(model).collect();
    logAdapter("findMany:queried", { model, count: docs.length });

    const filtered = sortDocs(
      docs.filter((d) => matchesWhere(d as DbRecord, args.where)),
      args.sortBy,
    );
    logAdapter("findMany:filtered", {
      model,
      count: filtered.length,
      hasSortBy: Boolean(args.sortBy),
    });

    const offset = args.offset ?? 0;
    const limit = args.limit ?? filtered.length;
    const sliced = filtered.slice(offset, offset + limit);
    logAdapter("findMany:sliced", { model, offset, limit, count: sliced.length });

    const result = sliced
      .map((doc: DbRecord) => toExternalDoc(doc))
      .filter((doc: DbRecord | null): doc is DbRecord => doc !== null);
    logAdapter("findMany:done", { model, count: result.length });
    return result;
  };

  const findOne = async (
    ctx: QueryOrMutationCtx<DataModel>,
    args: { model: string; select?: string[]; where?: Where[] },
  ) => {
    logAdapter("findOne:start", {
      model: args.model,
      whereCount: args.where?.length ?? 0,
      selectCount: args.select?.length ?? 0,
    });
    const docs = await findMany(ctx, {
      ...args,
      limit: 1,
    });

    const result = selectFields(docs[0] ?? null, args.select);
    logAdapter("findOne:done", { model: args.model, found: Boolean(result) });
    return result;
  };

  const create = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { data: DbRecord; model: string; select?: string[] },
  ) => {
    logAdapter("create:start", {
      model: args.model,
      selectCount: args.select?.length ?? 0,
      dataKeys: Object.keys(args.data),
    });
    const model = getAuthModel(args.model);
    const triggers = getTableTriggers(ctx, model);
    const triggerCtx = ctx as unknown as TriggerCtx;
    logAdapter("create:triggers-loaded", {
      model,
      hasCreateBefore: Boolean(triggers?.create?.before),
      hasCreateAfter: Boolean(triggers?.create?.after),
      hasChange: Boolean(triggers?.change),
    });

    const prepared = await applyBefore({
      ctx: triggerCtx,
      hook: triggers?.create?.before,
      input: args.data,
      model,
      operation: "create",
    });
    logAdapter("create:prepared", { model, dataKeys: Object.keys(prepared) });

    const id = await ctx.db.insert(model, normalizeWriteData(prepared) as never);
    logAdapter("create:inserted", { model, id: id as string });

    const raw = (await ctx.db.get(id)) as DbRecord | null;

    if (!raw) {
      logAdapter("create:missing-created-doc", { model, id: id as string });
      throw new Error(`Failed to load created auth document '${args.model}'.`);
    }

    const created = toExternalDoc(raw) as DbRecord;
    logAdapter("create:loaded-created-doc", { model, id: created.id });

    await triggers?.create?.after?.(created, triggerCtx);
    logAdapter("create:after-trigger-fired", { model, id: created.id });

    await triggers?.change?.(
      { id: created.id, newDoc: created, oldDoc: null, operation: "insert" },
      triggerCtx,
    );
    logAdapter("create:change-trigger-fired", { model, id: created.id });

    const result = selectFields(created, args.select);
    logAdapter("create:done", { model, id: created.id });
    return result;
  };

  const updateMany = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { model: string; update: DbRecord; where?: Where[] },
  ) => {
    logAdapter("updateMany:start", { model: args.model, whereCount: args.where?.length ?? 0 });
    const model = getAuthModel(args.model);
    const matches = await findMany(ctx, { model, where: args.where });
    const triggers = getTableTriggers(ctx, model);
    const triggerCtx = ctx as unknown as TriggerCtx;
    logAdapter("updateMany:matches-found", { model, count: matches.length });

    const results = await Promise.all(
      matches.map(async (match: DbRecord): Promise<GenericId<string> | null> => {
        logAdapter("updateMany:item:start", { model, id: match.id });
        const patched = await applyBefore({
          ctx: triggerCtx,
          hook: triggers?.update?.before,
          input: args.update,
          model,
          operation: "update",
        });
        logAdapter("updateMany:item:prepared", {
          model,
          id: match.id,
          updateKeys: Object.keys(patched),
        });

        const id = match.id as GenericId<string>;

        await ctx.db.patch(id, stripWriteFields(normalizeWriteData(patched)) as never);
        logAdapter("updateMany:item:patched", { model, id: id as string });

        const raw = (await ctx.db.get(id)) as DbRecord | null;

        if (!raw) {
          logAdapter("updateMany:item:missing-doc-after-patch", { model, id: id as string });
          return null;
        }

        const newDoc = toExternalDoc(raw) as DbRecord;
        logAdapter("updateMany:item:loaded-updated-doc", { model, id: newDoc.id });

        await triggers?.update?.after?.(newDoc, triggerCtx);
        logAdapter("updateMany:item:update-after-trigger-fired", { model, id: newDoc.id });

        await triggers?.change?.(
          { id: newDoc.id, newDoc, oldDoc: match, operation: "update" },
          triggerCtx,
        );
        logAdapter("updateMany:item:change-trigger-fired", { model, id: newDoc.id });

        return newDoc.id as GenericId<string>;
      }),
    );

    const ids = results.filter(
      (id: GenericId<string> | null): id is GenericId<string> => id !== null,
    );

    logAdapter("updateMany:done", { model: args.model, count: ids.length });
    return { count: ids.length, ids };
  };

  const updateOne = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { model: string; update: DbRecord; where?: Where[] },
  ) => {
    logAdapter("updateOne:start", { model: args.model, whereCount: args.where?.length ?? 0 });
    const result = await updateMany(ctx, args);

    if (result.ids.length === 0) {
      logAdapter("updateOne:no-match", { model: args.model });
      return null;
    }

    const updated = await findOne(ctx, {
      model: args.model,
      where: [{ field: "id", operator: "eq", value: result.ids[0] as string }],
    });
    logAdapter("updateOne:done", { model: args.model, id: result.ids[0] as string });
    return updated;
  };

  const deleteMany = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { model: string; where?: Where[] },
  ) => {
    logAdapter("deleteMany:start", { model: args.model, whereCount: args.where?.length ?? 0 });
    const model = getAuthModel(args.model);
    const triggers = getTableTriggers(ctx, model);
    const triggerCtx = ctx as unknown as TriggerCtx;
    const matches = await findMany(ctx, { model, where: args.where });
    logAdapter("deleteMany:matches-found", { model, count: matches.length });

    const ids = await Promise.all(
      matches.map(async (match: DbRecord) => {
        logAdapter("deleteMany:item:start", { model, id: match.id });
        await applyBefore({
          ctx: triggerCtx,
          hook: triggers?.delete?.before,
          input: match,
          model,
          operation: "delete",
        });
        logAdapter("deleteMany:item:before-trigger-complete", { model, id: match.id });

        await ctx.db.delete(match.id as GenericId<string>);
        logAdapter("deleteMany:item:deleted", { model, id: match.id });

        await triggers?.delete?.after?.(match, triggerCtx);
        logAdapter("deleteMany:item:delete-after-trigger-fired", { model, id: match.id });

        await triggers?.change?.(
          { id: match.id, newDoc: null, oldDoc: match, operation: "delete" },
          triggerCtx,
        );
        logAdapter("deleteMany:item:change-trigger-fired", { model, id: match.id });

        return match.id;
      }),
    );

    logAdapter("deleteMany:done", { model: args.model, count: ids.length });
    return { count: ids.length, ids };
  };

  const deleteOne = async (
    ctx: GenericMutationCtx<DataModel>,
    args: { model: string; where?: Where[] },
  ) => {
    logAdapter("deleteOne:start", { model: args.model, whereCount: args.where?.length ?? 0 });
    const match = await findOne(ctx, args);

    if (!match) {
      logAdapter("deleteOne:no-match", { model: args.model });
      return null;
    }

    await deleteMany(ctx, {
      model: args.model,
      where: [{ field: "id", operator: "eq", value: match.id as string }],
    });

    logAdapter("deleteOne:done", { model: args.model, id: match.id as string });
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
