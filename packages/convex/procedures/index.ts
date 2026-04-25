import {
  GenericDataModel,
  internalActionGeneric,
  internalQueryGeneric,
  queryGeneric,
  actionGeneric,
  mutationGeneric,
  internalMutationGeneric,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
} from "convex/server";
import type { GenericValidator, PropertyValidators } from "convex/values";

import type {
  ActionCtx,
  Context,
  ConvexBuilderDef,
  ConvexMiddleware,
  EmptyObject,
  MutationCtx,
  QueryCtx,
  AnyConvexMiddleware,
  CallableBuilder,
  ConvexArgsValidator,
  ConvexReturnsValidator,
  FunctionType,
  InferredArgs,
  RegisteredReturnType,
  InferredHandlerReturn,
  FunctionVisibility,
} from "./types";

class ConvexBuilderWithFunction<
  TDataModel extends GenericDataModel = GenericDataModel,
  TFunctionType extends FunctionType = FunctionType,
  TCurrentContext extends Context = EmptyObject,
  TArgsValidator extends ConvexArgsValidator | undefined = undefined,
  TReturnsValidator extends ConvexReturnsValidator | undefined = undefined,
> {
  protected def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>;

  constructor(def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>) {
    this.def = def;
  }

  protected _clone(def: ConvexBuilderDef<any, any, any>): any {
    return new ConvexBuilderWithFunction(def);
  }

  $context<U extends Context>(): {
    createMiddleware: <UOutContext extends Context>(
      middleware: ConvexMiddleware<U, UOutContext>,
    ) => ConvexMiddleware<U, UOutContext>;
  } {
    return {
      createMiddleware<UOutContext extends Context>(
        middleware: ConvexMiddleware<U, UOutContext>,
      ): ConvexMiddleware<U, UOutContext> {
        return middleware;
      },
    };
  }

  createMiddleware<UOutContext extends Context>(
    middleware: ConvexMiddleware<TCurrentContext, UOutContext>,
  ): ConvexMiddleware<TCurrentContext, UOutContext>;

  createMiddleware<UInContext extends Context, UOutContext extends Context>(
    middleware: ConvexMiddleware<UInContext, UOutContext>,
  ): ConvexMiddleware<UInContext, UOutContext>;

  createMiddleware<UInContext extends Context, UOutContext extends Context>(
    middleware: ConvexMiddleware<UInContext, UOutContext>,
  ): ConvexMiddleware<UInContext, UOutContext> {
    return middleware;
  }

  use<UOutContext extends Context>(
    middleware: ConvexMiddleware<TCurrentContext, UOutContext>,
  ): ConvexBuilderWithFunction<
    TDataModel,
    TFunctionType,
    TCurrentContext & UOutContext,
    TArgsValidator,
    TReturnsValidator
  > {
    return this._clone({
      ...this.def,
      middlewares: [...this.def.middlewares, middleware as AnyConvexMiddleware],
    });
  }

  input<UInput extends PropertyValidators | GenericValidator>(
    validator: UInput,
  ): ConvexBuilderWithFunction<
    TDataModel,
    TFunctionType,
    TCurrentContext,
    UInput extends ConvexArgsValidator ? UInput : ConvexArgsValidator,
    TReturnsValidator
  > {
    return this._clone({
      ...this.def,
      argsValidator: validator,
    });
  }

  returns<UReturns extends GenericValidator>(
    validator: UReturns,
  ): ConvexBuilderWithFunction<
    TDataModel,
    TFunctionType,
    TCurrentContext,
    TArgsValidator,
    UReturns extends ConvexReturnsValidator ? UReturns : ConvexReturnsValidator
  > {
    return this._clone({
      ...this.def,
      returnsValidator: validator,
    });
  }

  handler<
    TReturn extends InferredHandlerReturn<TReturnsValidator, any> = InferredHandlerReturn<
      TReturnsValidator,
      any
    >,
  >(
    handlerFn: (context: TCurrentContext, input: InferredArgs<TArgsValidator>) => Promise<TReturn>,
  ): ConvexBuilderWithHandler<
    InferredHandlerReturn<TReturnsValidator, TReturn>,
    TDataModel,
    TFunctionType,
    TArgsValidator,
    TCurrentContext,
    TReturnsValidator
  > &
    CallableBuilder<
      TCurrentContext,
      TArgsValidator,
      InferredHandlerReturn<TReturnsValidator, TReturn>
    > {
    if (this.def.handler) {
      throw new Error("Handler already defined. Only one handler can be set per function chain.");
    }

    const rawHandler = async (transformedCtx: Context, baseArgs: InferredArgs<TArgsValidator>) =>
      handlerFn(transformedCtx as TCurrentContext, baseArgs);

    type InferredReturn = InferredHandlerReturn<TReturnsValidator, TReturn>;

    return ConvexBuilderWithHandler.create<
      InferredReturn,
      TDataModel,
      TFunctionType,
      TArgsValidator,
      TCurrentContext,
      TReturnsValidator
    >({
      ...this.def,
      handler: rawHandler as any,
    });
  }
}

class ConvexBuilderWithHandler<
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
    const NO_HANDLER_RESULT = Symbol("no_handler_result");
    let handlerResult: any = NO_HANDLER_RESULT;

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

    if (handlerResult === NO_HANDLER_RESULT) {
      throw new Error("Middleware chain completed without calling the handler.");
    }

    return handlerResult as THandlerReturn;
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
    return ConvexBuilderWithHandler.create<
      THandlerReturn,
      TDataModel,
      TFunctionType,
      TArgsValidator,
      TCurrentContext & UOutContext,
      TReturnsValidator
    >({
      ...this.def,
      middlewares: [...this.def.middlewares, middleware as AnyConvexMiddleware],
    });
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

class ConvexBuilder<TDataModel extends GenericDataModel = GenericDataModel> {
  protected def: ConvexBuilderDef;

  constructor(def: ConvexBuilderDef) {
    this.def = def;
  }

  query(): ConvexBuilderWithFunction<TDataModel, "query", QueryCtx<TDataModel>> {
    return new ConvexBuilderWithFunction<TDataModel, "query", QueryCtx<TDataModel>>({
      ...this.def,
      functionType: "query",
    });
  }

  mutation(): ConvexBuilderWithFunction<TDataModel, "mutation", MutationCtx<TDataModel>> {
    return new ConvexBuilderWithFunction<TDataModel, "mutation", MutationCtx<TDataModel>>({
      ...this.def,
      functionType: "mutation",
    });
  }

  action(): ConvexBuilderWithFunction<TDataModel, "action", ActionCtx<TDataModel>> {
    return new ConvexBuilderWithFunction<TDataModel, "action", ActionCtx<TDataModel>>({
      ...this.def,
      functionType: "action",
    });
  }

  $context<U extends Context>(): {
    createMiddleware: <UOutContext extends Context>(
      middleware: ConvexMiddleware<U, UOutContext>,
    ) => ConvexMiddleware<U, UOutContext>;
  } {
    return {
      createMiddleware<UOutContext extends Context>(
        middleware: ConvexMiddleware<U, UOutContext>,
      ): ConvexMiddleware<U, UOutContext> {
        return middleware;
      },
    };
  }

  createMiddleware<UOutContext extends Context>(
    middleware: ConvexMiddleware<EmptyObject, UOutContext>,
  ): ConvexMiddleware<EmptyObject, UOutContext>;

  createMiddleware<UInContext extends Context, UOutContext extends Context>(
    middleware: ConvexMiddleware<UInContext, UOutContext>,
  ): ConvexMiddleware<UInContext, UOutContext>;

  createMiddleware<UInContext extends Context, UOutContext extends Context>(
    middleware: ConvexMiddleware<UInContext, UOutContext>,
  ): ConvexMiddleware<UInContext, UOutContext> {
    return middleware;
  }
}

export function createBuilder<TDataModel extends GenericDataModel>(): ConvexBuilder<TDataModel> {
  return new ConvexBuilder<TDataModel>({
    middlewares: [],
  });
}
