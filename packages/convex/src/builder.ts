import {
  GenericDataModel,
  internalActionGeneric,
  internalQueryGeneric,
  queryGeneric,
  actionGeneric,
  mutationGeneric,
  internalMutationGeneric,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
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
    createMiddleware<UOutContext extends Context>(
      middleware: ConvexMiddleware<U, UOutContext>,
    ): ConvexMiddleware<U, UOutContext>;
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
    THandlerFn extends (
      context: TCurrentContext,
      input: InferredArgs<TArgsValidator>,
    ) => Promise<TReturn> = (
      context: TCurrentContext,
      input: InferredArgs<TArgsValidator>,
    ) => Promise<TReturn>,
  >(
    handlerFn: THandlerFn &
      ((context: TCurrentContext, input: InferredArgs<TArgsValidator>) => Promise<TReturn>),
  ): ConvexBuilderWithHandler<
    TDataModel,
    TFunctionType,
    TCurrentContext,
    TArgsValidator,
    TReturnsValidator,
    InferredHandlerReturn<TReturnsValidator, TReturn>
  > &
    THandlerFn &
    CallableBuilder<
      TCurrentContext,
      TArgsValidator,
      InferredHandlerReturn<TReturnsValidator, TReturn>
    > {
    if (this.def.handler) {
      throw new Error("Handler already defined. Only one handler can be set per function chain.");
    }

    const rawHandler = async (transformedCtx: Context, baseArgs: InferredArgs<TArgsValidator>) => {
      return handlerFn(transformedCtx as TCurrentContext, baseArgs);
    };

    type InferredReturn = InferredHandlerReturn<TReturnsValidator, TReturn>;

    return new ConvexBuilderWithHandler<
      TDataModel,
      TFunctionType,
      TCurrentContext,
      TArgsValidator,
      TReturnsValidator,
      InferredReturn
    >({
      ...this.def,
      handler: rawHandler as any,
    }) as ConvexBuilderWithHandler<
      TDataModel,
      TFunctionType,
      TCurrentContext,
      TArgsValidator,
      TReturnsValidator,
      InferredReturn
    > &
      THandlerFn &
      CallableBuilder<TCurrentContext, TArgsValidator, InferredReturn>;
  }
}

class ConvexBuilderWithHandler<
  TDataModel extends GenericDataModel = GenericDataModel,
  TFunctionType extends FunctionType = FunctionType,
  TCurrentContext extends Context = EmptyObject,
  TArgsValidator extends ConvexArgsValidator | undefined = undefined,
  TReturnsValidator extends ConvexReturnsValidator | undefined = undefined,
  THandlerReturn = any,
> {
  protected def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>;

  constructor(def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>) {
    this.def = def;

    const callable = ((context: TCurrentContext, args: InferredArgs<TArgsValidator>) => {
      return this._call(context, args);
    }) as any;

    const proto = ConvexBuilderWithHandler.prototype;
    const props = Object.getOwnPropertyNames(proto);

    for (const prop of props) {
      if (prop !== "constructor") {
        const value = (proto as any)[prop];
        if (typeof value === "function") {
          callable[prop] = value.bind(this);
        }
      }
    }

    callable.def = this.def;

    return callable;
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
    const { argsTransform, returnsTransform } = this.def;
    if (argsTransform) {
      args = argsTransform(args);
    }

    let handlerResult: any;
    let handlerCalled = false;

    const createNext = (index: number) => {
      return async <U extends Context>(ctx: U): Promise<{ context: U }> => {
        if (index >= middlewares.length) {
          handlerCalled = true;
          handlerResult = await handler(ctx as any, args);
          return { context: ctx };
        }

        const result = await middlewares[index](ctx, createNext(index + 1));
        return result as { context: U };
      };
    };

    await createNext(0)(initialContext);

    if (!handlerCalled) {
      throw new Error("Middleware chain completed without calling the handler.");
    }

    if (returnsTransform) {
      handlerResult = returnsTransform(handlerResult);
    }

    return handlerResult;
  }

  use<UOutContext extends Context>(
    middleware: ConvexMiddleware<TCurrentContext, UOutContext>,
  ): ConvexBuilderWithHandler<
    TDataModel,
    TFunctionType,
    TCurrentContext & UOutContext,
    TArgsValidator,
    TReturnsValidator,
    THandlerReturn
  > &
    CallableBuilder<TCurrentContext & UOutContext, TArgsValidator, THandlerReturn> {
    return new ConvexBuilderWithHandler<
      TDataModel,
      TFunctionType,
      TCurrentContext & UOutContext,
      TArgsValidator,
      TReturnsValidator,
      THandlerReturn
    >({
      ...this.def,
      middlewares: [...this.def.middlewares, middleware as AnyConvexMiddleware],
    }) as ConvexBuilderWithHandler<
      TDataModel,
      TFunctionType,
      TCurrentContext & UOutContext,
      TArgsValidator,
      TReturnsValidator,
      THandlerReturn
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

  private _register(visibility: FunctionVisibility): any {
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
    ) => {
      return this._executeWithMiddleware(middlewares, baseCtx as Context, handler, baseArgs);
    };

    const config = {
      args: argsValidator || {},
      ...(returnsValidator ? { returns: returnsValidator } : {}),
      handler: composedHandler,
    } as any;

    const isPublic = visibility === "public";
    const registrationFn = {
      query: isPublic ? queryGeneric : internalQueryGeneric,
      mutation: isPublic ? mutationGeneric : internalMutationGeneric,
      action: isPublic ? actionGeneric : internalActionGeneric,
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
