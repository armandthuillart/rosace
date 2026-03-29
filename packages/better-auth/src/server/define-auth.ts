import type { BetterAuthOptions } from "better-auth";
import type {
  DocumentByName,
  GenericDataModel,
  GenericSchema,
  SchemaDefinition,
} from "convex/server";

type MaybePromise<T> = T | Promise<T>;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type DateifyAtFields<TDoc extends Record<string, unknown>> = Simplify<{
  [K in keyof TDoc]: K extends `${string}At` ? (TDoc[K] extends number ? Date : TDoc[K]) : TDoc[K];
}>;

type RemoveSystemFields<TDoc extends Record<string, unknown>> = Simplify<{
  [K in keyof TDoc as K extends "_id" | "_creationTime" ? never : K]: TDoc[K];
}>;

type RawTableDoc<DataModel extends GenericDataModel, TableName extends string> = DocumentByName<
  DataModel,
  TableName
>;

type AuthTriggerDoc<DataModel extends GenericDataModel, TableName extends string> = Simplify<
  RemoveSystemFields<RawTableDoc<DataModel, TableName>> &
    (RawTableDoc<DataModel, TableName> extends { _id: infer TId }
      ? { id: TId }
      : Record<never, never>)
>;

type AuthTriggerInsertData<
  DataModel extends GenericDataModel,
  TableName extends string,
> = DateifyAtFields<RemoveSystemFields<RawTableDoc<DataModel, TableName>>>;

type AuthTriggerUpdateData<DataModel extends GenericDataModel, TableName extends string> = Partial<
  AuthTriggerInsertData<DataModel, TableName>
>;

type TriggerChangeId<TDoc> = TDoc extends { _id: infer TId }
  ? TId
  : TDoc extends { id: infer TId }
    ? TId
    : unknown;

type GenericAuthTriggerChange<
  TDoc extends Record<string, unknown> = Record<string, unknown>,
  TId = TriggerChangeId<TDoc>,
> =
  | {
      id: TId;
      newDoc: TDoc;
      oldDoc: null;
      operation: "insert";
    }
  | {
      id: TId;
      newDoc: TDoc;
      oldDoc: TDoc;
      operation: "update";
    }
  | {
      id: TId;
      newDoc: null;
      oldDoc: TDoc;
      operation: "delete";
    };

type GenericAuthBeforeResult<TData extends Record<string, unknown>> =
  // biome-ignore lint/suspicious/noConfusingVoidType: before hooks intentionally support "return nothing".
  | void
  | false
  | {
      data: Partial<TData>;
    };

interface GenericAuthTriggerHandlers<
  DataModel extends GenericDataModel,
  TableName extends string,
  MutationCtx,
> {
  change?: (
    change: GenericAuthTriggerChange<AuthTriggerDoc<DataModel, TableName>>,
    ctx: MutationCtx,
  ) => MaybePromise<void>;
  create?: {
    after?: (doc: AuthTriggerDoc<DataModel, TableName>, ctx: MutationCtx) => MaybePromise<void>;
    before?: (
      data: AuthTriggerInsertData<DataModel, TableName>,
      ctx: MutationCtx,
    ) => MaybePromise<GenericAuthBeforeResult<AuthTriggerInsertData<DataModel, TableName>>>;
  };
  delete?: {
    after?: (doc: AuthTriggerDoc<DataModel, TableName>, ctx: MutationCtx) => MaybePromise<void>;
    before?: (
      doc: AuthTriggerDoc<DataModel, TableName>,
      ctx: MutationCtx,
    ) => MaybePromise<GenericAuthBeforeResult<AuthTriggerDoc<DataModel, TableName>>>;
  };
  update?: {
    after?: (newDoc: AuthTriggerDoc<DataModel, TableName>, ctx: MutationCtx) => MaybePromise<void>;
    before?: (
      update: AuthTriggerUpdateData<DataModel, TableName>,
      ctx: MutationCtx,
    ) => MaybePromise<GenericAuthBeforeResult<AuthTriggerUpdateData<DataModel, TableName>>>;
  };
}

type GenericAuthTriggers<
  DataModel extends GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true>,
  MutationCtx = unknown,
> = {
  [K in keyof Schema["tables"] & string]?: GenericAuthTriggerHandlers<DataModel, K, MutationCtx>;
};

type BetterAuthOptionsWithoutDatabase = Omit<BetterAuthOptions, "database">;

type GenericAuthDefinition<
  GenericCtx = unknown,
  DataModel extends GenericDataModel = GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true> = SchemaDefinition<GenericSchema, true>,
  AuthOptions extends BetterAuthOptionsWithoutDatabase = BetterAuthOptionsWithoutDatabase,
  MutationCtx = GenericCtx,
> = (ctx: GenericCtx) => AuthOptions & {
  triggers?: GenericAuthTriggers<DataModel, Schema, MutationCtx>;
};

const defineAuth = <
  GenericCtx = unknown,
  DataModel extends GenericDataModel = GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true> = SchemaDefinition<GenericSchema, true>,
  AuthOptions extends BetterAuthOptionsWithoutDatabase = BetterAuthOptionsWithoutDatabase,
  MutationCtx = GenericCtx,
>(
  definition: GenericAuthDefinition<GenericCtx, DataModel, Schema, AuthOptions, MutationCtx>,
) => definition;

export {
  type BetterAuthOptionsWithoutDatabase,
  defineAuth,
  type GenericAuthBeforeResult,
  type GenericAuthDefinition,
  type GenericAuthTriggerChange,
  type GenericAuthTriggers,
};
