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

type AuthTriggerChange<
  TDoc extends Record<string, unknown> = Record<string, unknown>,
  TId = TriggerChangeId<TDoc>,
> =
  | { id: TId; newDoc: TDoc; oldDoc: null; operation: "insert" }
  | { id: TId; newDoc: TDoc; oldDoc: TDoc; operation: "update" }
  | { id: TId; newDoc: null; oldDoc: TDoc; operation: "delete" };

export type AuthBeforeResult<TData extends Record<string, unknown>> =
  | void
  | false
  | {
      data: Partial<TData>;
    };

export interface AuthTriggerHandlers<
  DataModel extends GenericDataModel,
  TableName extends string,
  MutationCtx,
> {
  change?: (
    change: AuthTriggerChange<AuthTriggerDoc<DataModel, TableName>>,
    ctx: MutationCtx,
  ) => MaybePromise<void>;
  create?: {
    after?: (doc: AuthTriggerDoc<DataModel, TableName>, ctx: MutationCtx) => MaybePromise<void>;
    before?: (
      data: AuthTriggerInsertData<DataModel, TableName>,
      ctx: MutationCtx,
    ) => MaybePromise<AuthBeforeResult<AuthTriggerInsertData<DataModel, TableName>>>;
  };
  delete?: {
    after?: (doc: AuthTriggerDoc<DataModel, TableName>, ctx: MutationCtx) => MaybePromise<void>;
    before?: (
      doc: AuthTriggerDoc<DataModel, TableName>,
      ctx: MutationCtx,
    ) => MaybePromise<AuthBeforeResult<AuthTriggerDoc<DataModel, TableName>>>;
  };
  update?: {
    after?: (newDoc: AuthTriggerDoc<DataModel, TableName>, ctx: MutationCtx) => MaybePromise<void>;
    before?: (
      update: AuthTriggerUpdateData<DataModel, TableName>,
      ctx: MutationCtx,
    ) => MaybePromise<AuthBeforeResult<AuthTriggerUpdateData<DataModel, TableName>>>;
  };
}

type AuthTriggers<
  DataModel extends GenericDataModel,
  Schema extends SchemaDefinition<GenericSchema, true>,
  MutationCtx = unknown,
> = {
  [K in keyof Schema["tables"] & string]?: AuthTriggerHandlers<DataModel, K, MutationCtx>;
};

type AuthSchema = SchemaDefinition<GenericSchema, true>;

type AuthCtx<DataModel extends GenericDataModel = GenericDataModel> =
  import("convex/server").GenericMutationCtx<DataModel>;

type BetterAuthOptionsWithoutDatabase = Omit<BetterAuthOptions, "database">;

export {
  AuthSchema,
  AuthCtx,
  BetterAuthOptionsWithoutDatabase,
  AuthTriggerDoc,
  AuthTriggerInsertData,
  AuthTriggerUpdateData,
  AuthTriggerChange,
  AuthTriggers,
};
