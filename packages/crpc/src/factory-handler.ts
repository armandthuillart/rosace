import {
  actionGeneric,
  type GenericDataModel,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
  type RegisteredAction,
  type RegisteredMutation,
  type RegisteredQuery,
} from "convex/server";

import type {
  ActionCtx,
  AnyConvexMiddleware,
  CallableBuilder,
  Context,
  ConvexArgsValidator,
  ConvexBuilderDef,
  ConvexMiddleware,
  ConvexReturnsValidator,
  EmptyObject,
  ExpectedReturnType,
  FunctionType,
  FunctionVisibility,
  InferredArgs,
  MutationCtx,
  QueryCtx,
} from "./types";

type RegisteredReturnType<
  TReturnsValidator extends ConvexReturnsValidator | undefined,
  THandlerReturn,
> = [TReturnsValidator] extends [ConvexReturnsValidator]
  ? Promise<ExpectedReturnType<TReturnsValidator>>
  : Promise<THandlerReturn>;

export class ConvexBuilderWithHandler<
  THandlerReturn = any,
  TDataModel extends GenericDataModel = GenericDataModel,
  TFunctionType extends FunctionType = FunctionType,
  TArgsValidator extends ConvexArgsValidator | undefined = undefined,
  TCurrentContext extends Context = EmptyObject,
  TReturnsValidator extends ConvexReturnsValidator | undefined = undefined,
> {
  protected def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>;

  constructor(def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>) {
    this.def = def;
  }

  static create<
    THandlerReturn = any,
    TDataModel extends GenericDataModel = GenericDataModel,
    TFunctionType extends FunctionType = FunctionType,
    TArgsValidator extends ConvexArgsValidator | undefined = undefined,
    TCurrentContext extends Context = EmptyObject,
    TReturnsValidator extends ConvexReturnsValidator | undefined = undefined,
  >(
    def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>,
  ): ConvexBuilderWithHandler<
    THandlerReturn,
    TDataModel,
    TFunctionType,
    TArgsValidator,
    TCurrentContext,
    TReturnsValidator
  > &
    CallableBuilder<TCurrentContext, TArgsValidator, THandlerReturn> {
    const instance = new ConvexBuilderWithHandler<
      THandlerReturn,
      TDataModel,
      TFunctionType,
      TArgsValidator,
      TCurrentContext,
      TReturnsValidator
    >(def);

    const callable = ((context: TCurrentContext, args: InferredArgs<TArgsValidator>) =>
      instance._call(context, args)) as any;

    const proto = ConvexBuilderWithHandler.prototype;
    const props = Object.getOwnPropertyNames(proto);

    for (const prop of props) {
      if (prop !== "constructor") {
        const value = (proto as any)[prop];

        if (typeof value === "function") {
          callable[prop] = value.bind(instance);
        }
      }
    }

    callable.def = instance.def;

    return callable as ConvexBuilderWithHandler<
      THandlerReturn,
      TDataModel,
      TFunctionType,
      TArgsValidator,
      TCurrentContext,
      TReturnsValidator
    > &
      CallableBuilder<TCurrentContext, TArgsValidator, THandlerReturn>;
  }

  private async _call(
    context: TCurrentContext,
    args: InferredArgs<TArgsValidator>,
  ): Promise<THandlerReturn> {
    const { handler, middlewares } = this.def;

    if (!handler) {
      throw new Error("Handler not set.");
    }

    return this._executeWithMiddleware(middlewares, context as Context, handler, args);
  }

  private async _executeWithMiddleware(
    middlewares: readonly AnyConvexMiddleware[],
    initialContext: Context,
    handler: (context: Context, args: any) => Promise<any>,
    args: any,
  ): Promise<THandlerReturn> {
    let handlerResult: any;

    const createNext = (index: number) => {
      return async <U extends Context>(ctx: U): Promise<{ context: U }> => {
        if (index >= middlewares.length) {
          handlerResult = await handler(ctx as any, args);
          return { context: ctx };
        }

        const result = await middlewares[index](ctx, createNext(index + 1));

        return result as { context: U };
      };
    };

    await createNext(0)(initialContext);

    return handlerResult;
  }

  use<UOutContext extends Context>(
    middleware: ConvexMiddleware<TCurrentContext, UOutContext>,
  ): ConvexBuilderWithHandler<
    THandlerReturn,
    TDataModel,
    TFunctionType,
    TArgsValidator,
    TCurrentContext & UOutContext,
    TReturnsValidator
  > &
    CallableBuilder<TCurrentContext & UOutContext, TArgsValidator, THandlerReturn> {
    return new ConvexBuilderWithHandler<
      THandlerReturn,
      TDataModel,
      TFunctionType,
      TArgsValidator,
      TCurrentContext & UOutContext,
      TReturnsValidator
    >({
      ...this.def,
      middlewares: [...this.def.middlewares, middleware as AnyConvexMiddleware],
    }) as ConvexBuilderWithHandler<
      THandlerReturn,
      TDataModel,
      TFunctionType,
      TArgsValidator,
      TCurrentContext & UOutContext,
      TReturnsValidator
    > &
      CallableBuilder<TCurrentContext & UOutContext, TArgsValidator, THandlerReturn>;
  }

  public(): TFunctionType extends "query"
    ? RegisteredQuery<
        "public",
        InferredArgs<TArgsValidator>,
        RegisteredReturnType<TReturnsValidator, THandlerReturn>
      >
    : TFunctionType extends "mutation"
      ? RegisteredMutation<
          "public",
          InferredArgs<TArgsValidator>,
          RegisteredReturnType<TReturnsValidator, THandlerReturn>
        >
      : TFunctionType extends "action"
        ? RegisteredAction<
            "public",
            InferredArgs<TArgsValidator>,
            RegisteredReturnType<TReturnsValidator, THandlerReturn>
          >
        : never {
    return this._register("public") as any;
  }

  internal(): TFunctionType extends "query"
    ? RegisteredQuery<
        "internal",
        InferredArgs<TArgsValidator>,
        RegisteredReturnType<TReturnsValidator, THandlerReturn>
      >
    : TFunctionType extends "mutation"
      ? RegisteredMutation<
          "internal",
          InferredArgs<TArgsValidator>,
          RegisteredReturnType<TReturnsValidator, THandlerReturn>
        >
      : TFunctionType extends "action"
        ? RegisteredAction<
            "internal",
            InferredArgs<TArgsValidator>,
            RegisteredReturnType<TReturnsValidator, THandlerReturn>
          >
        : never {
    return this._register("internal") as any;
  }

  private _register(functionVisibility: FunctionVisibility): any {
    const { functionType, argsValidator, returnsValidator, handler, middlewares } = this.def;

    if (!functionType) {
      throw new Error("Function type not set. Call .query(), .mutation(), or .action() first.");
    }

    if (!handler) {
      throw new Error("Handler not set. Call .handler() before .public() or .internal().");
    }

    const composedHandler = async (
      baseCtx: QueryCtx<TDataModel> | MutationCtx<TDataModel> | ActionCtx<TDataModel>,
      baseArgs: any,
    ) => this._executeWithMiddleware(middlewares, baseCtx as Context, handler, baseArgs);

    const config = {
      args: argsValidator || {},
      ...(returnsValidator ? { returns: returnsValidator } : {}),
      handler: composedHandler,
    } as any;

    const isPublic = functionVisibility === "public";

    const registrationFn = {
      action: isPublic ? actionGeneric : internalActionGeneric,
      mutation: isPublic ? mutationGeneric : internalMutationGeneric,
      query: isPublic ? queryGeneric : internalQueryGeneric,
    }[functionType];

    return registrationFn(config);
  }
}
