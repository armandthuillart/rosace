import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { GenericValidator, PropertyValidators } from "convex/values";

type EmptyObject = Record<never, never>;

type QueryCtx<DataModel extends GenericDataModel = GenericDataModel> = GenericQueryCtx<DataModel>;

type MutationCtx<DataModel extends GenericDataModel = GenericDataModel> =
  GenericMutationCtx<DataModel>;

type ActionCtx<DataModel extends GenericDataModel = GenericDataModel> = GenericActionCtx<DataModel>;

type Context = object;
type FunctionType = "query" | "mutation" | "action";
type FunctionVisibility = "public" | "internal";
type ConvexArgsValidator = PropertyValidators | GenericValidator;
type ConvexReturnsValidator = GenericValidator;

interface ConvexBuilderDef<
  TFunctionType extends FunctionType | undefined = undefined,
  TArgsValidator extends ConvexArgsValidator | undefined = undefined,
  TReturnsValidator extends ConvexReturnsValidator | undefined = undefined,
> {
  handler?: (context: Context, input: any) => Promise<any>;
  middlewares: readonly AnyConvexMiddleware[];
  functionType?: TFunctionType;
  argsValidator?: TArgsValidator;
  argsTransform?: (args: unknown) => unknown;
  returnsValidator?: TReturnsValidator;
  returnsTransform?: (result: unknown) => unknown;
}

type Promisable<T> = T | PromiseLike<T>;

type ConvexMiddleware<TInContext extends Context, TOutContext extends Context> = (
  context: TInContext,
  next: <U extends Context>(context: U) => Promisable<{ context: U }>,
) => Promisable<{
  context: TOutContext;
}>;

type AnyConvexMiddleware = ConvexMiddleware<any, any>;

type OptionalKeys<T extends Record<PropertyKey, any>> = {
  [K in keyof T]: T[K] extends GenericValidator
    ? T[K]["isOptional"] extends "optional"
      ? K
      : never
    : never;
}[keyof T];

type RequiredKeys<T extends Record<PropertyKey, any>> = {
  [K in keyof T]: T[K] extends GenericValidator
    ? T[K]["isOptional"] extends "optional"
      ? never
      : K
    : never;
}[keyof T];

type ValidatorType<T> = T extends GenericValidator ? T["type"] : never;

type OptionalArgs<T extends Record<PropertyKey, any>> = {
  [K in OptionalKeys<T>]?: T[K] extends GenericValidator ? ValidatorType<T[K]> | undefined : never;
};

type RequiredArgs<T extends Record<PropertyKey, any>> = {
  [K in RequiredKeys<T>]: ValidatorType<T[K]>;
};

type InferArgs<T extends ConvexArgsValidator> = T extends GenericValidator
  ? T["type"]
  : RequiredArgs<T> & OptionalArgs<T>;

type InferredArgs<T extends ConvexArgsValidator | undefined> = T extends ConvexArgsValidator
  ? InferArgs<T>
  : EmptyObject;

type CallableBuilder<
  TCurrentContext extends Context,
  TArgsValidator extends ConvexArgsValidator | undefined,
  THandlerReturn,
> = (context: TCurrentContext, args: InferredArgs<TArgsValidator>) => Promise<THandlerReturn>;

type InferReturns<T extends ConvexReturnsValidator> = ValidatorType<T>;

type ExpectedReturnType<TReturnsValidator extends ConvexReturnsValidator | undefined> =
  TReturnsValidator extends ConvexReturnsValidator ? InferReturns<TReturnsValidator> : any;

type InferredHandlerReturn<
  TReturnsValidator extends ConvexReturnsValidator | undefined,
  TReturn,
> = [TReturnsValidator] extends [ConvexReturnsValidator]
  ? ExpectedReturnType<TReturnsValidator>
  : TReturn;

type RegisteredReturnType<
  TReturnsValidator extends ConvexReturnsValidator | undefined,
  THandlerReturn,
> = [TReturnsValidator] extends [ConvexReturnsValidator]
  ? Promise<ExpectedReturnType<TReturnsValidator>>
  : Promise<THandlerReturn>;

export type {
  ConvexBuilderDef,
  Context,
  ExpectedReturnType,
  InferredArgs,
  InferredHandlerReturn,
  ConvexArgsValidator,
  ConvexReturnsValidator,
  AnyConvexMiddleware,
  ConvexMiddleware,
  EmptyObject,
  CallableBuilder,
  QueryCtx,
  MutationCtx,
  ActionCtx,
  FunctionType,
  RegisteredReturnType,
  FunctionVisibility,
};
