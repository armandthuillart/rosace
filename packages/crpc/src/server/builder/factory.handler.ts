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

/**
 * Determines the return type for a registered Convex function.
 *
 * If a returns validator is provided, the registered function resolves to the type
 * derived from the validator. This avoids circular type references when actions
 * call other functions in the same file using `api.*` without explicit `.returns()` annotation.
 * Otherwise, the function resolves to the handler's return type.
 *
 * @template TReturnsValidator - The return value validator type, if provided.
 * @template THandlerReturn - The raw type returned by the handler.
 * @returns {Promise<ExpectedReturnType<TReturnsValidator>> | Promise<THandlerReturn>}
 * Either a promise of the return type from the validator, or the handler's return type.
 */
type RegisteredReturnType<
  TReturnsValidator extends ConvexReturnsValidator | undefined,
  THandlerReturn,
> = [TReturnsValidator] extends [ConvexReturnsValidator]
  ? Promise<ExpectedReturnType<TReturnsValidator>>
  : Promise<THandlerReturn>;

/**
 * Builder for Convex functions once a handler has been attached.
 *
 * This class is responsible for:
 * - running middleware in onion order around the handler
 * - registering the function with Convex using the correct visibility
 * - exposing a callable function type to user code
 *
 * Prefer using {@link ConvexBuilderWithHandler.create} to construct instances.
 *
 * @typeParam THandlerReturn - The raw return type of the handler.
 * @typeParam TDataModel - The Convex data model.
 * @typeParam TFunctionType - The Convex function type (`"query"`, `"mutation"`, or `"action"`).
 * @typeParam TArgsValidator - The validator used for function arguments.
 * @typeParam TCurrentContext - The middleware-enriched context type.
 * @typeParam TReturnsValidator - The validator used for the function return value.
 */
export class ConvexBuilderWithHandler<
  THandlerReturn = any,
  TDataModel extends GenericDataModel = GenericDataModel,
  TFunctionType extends FunctionType = FunctionType,
  TArgsValidator extends ConvexArgsValidator | undefined = undefined,
  TCurrentContext extends Context = EmptyObject,
  TReturnsValidator extends ConvexReturnsValidator | undefined = undefined,
> {
  protected def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>;

  /**
   * Creates a new handler builder.
   *
   * @param def - Internal builder definition for this Convex function.
   * @internal Prefer using {@link ConvexBuilderWithHandler.create}.
   */
  constructor(def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>) {
    this.def = def;
  }

  /**
   * Factory that returns a callable builder instance.
   *
   * The returned value behaves both as:
   * - a configured builder (with methods like {@link use}, {@link public}, {@link internal})
   * - a callable function that runs the handler with all middleware applied.
   *
   * @typeParam THandlerReturn - The raw return type of the handler.
   * @typeParam TDataModel - The Convex data model.
   * @typeParam TFunctionType - The Convex function type.
   * @typeParam TArgsValidator - The validator used for function arguments.
   * @typeParam TCurrentContext - The middleware-enriched context type.
   * @typeParam TReturnsValidator - The validator used for the function return value.
   * @param def - Internal builder definition for this Convex function.
   * @returns A callable builder that can be further configured and then registered.
   */
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

  /**
   * Invokes the handler with the configured middleware chain.
   *
   * @param context - The middleware-enriched context.
   * @param args - The function arguments inferred from the validator.
   * @returns A promise that resolves to the handler's return value.
   * @private
   */
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

  /**
   * Runs middleware in onion order: each middleware's `next()` runs the rest of the chain
   * (remaining middleware + handler). This lets middleware run code before and after the
   * downstream chain, catch errors, measure timing, etc.
   *
   * No additional validation or transformation is performed here; all logic lives in
   * user-defined middleware and the handler itself.
   *
   * @param middlewares - Middleware functions to compose around the handler.
   * @param initialContext - Starting context passed to the first middleware.
   * @param handler - The final handler invoked at the end of the chain.
   * @param args - The arguments passed to the handler.
   * @returns A promise that resolves to the handler's return value.
   * @private
   */
  private async _executeWithMiddleware(
    middlewares: readonly AnyConvexMiddleware[],
    initialContext: Context,
    handler: (context: Context, args: any) => Promise<any>,
    args: any,
  ): Promise<THandlerReturn> {
    let handlerResult: any;

    /**
     * Build a recursive chain where calling `next(ctx)` runs the next
     * middleware, and the innermost `next` runs the handler.
     *
     * @param index - The current middleware index.
     * @returns A function that creates the next middleware in the chain.
     */
    // middleware, and the innermost `next` runs the handler.
    const createNext = (index: number) => {
      return async <U extends Context>(ctx: U): Promise<{ context: U }> => {
        if (index >= middlewares.length) {
          /**
           * End of middleware chain — execute the handler.
           *
           * @param ctx - The middleware-enriched context.
           * @param args - The function arguments.
           * @returns The handler's return value.
           */
          handlerResult = await handler(ctx as any, args);
          return { context: ctx };
        }

        /**
         * Call the current middleware, passing a `next` that continues the chain.
         *
         * @param ctx - The middleware-enriched context.
         * @param next - The next middleware in the chain.
         * @returns The result of the middleware.
         */
        const result = await middlewares[index](ctx, createNext(index + 1));

        return result as { context: U };
      };
    };

    await createNext(0)(initialContext);

    return handlerResult;
  }

  /**
   * Adds middleware to this function, extending the context type.
   *
   * @typeParam UOutContext - The additional context produced by the middleware.
   * @param middleware - Middleware to run before the handler (and any later middleware).
   * @returns A new builder whose context type includes `UOutContext`.
   */
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

  /**
   * Registers this function as a public Convex function.
   *
   * The return type is a Convex-registered function type that can be exposed
   * on the public API.
   *
   * @returns A Convex-registered function with public visibility.
   */
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

  /**
   * Registers this function as an internal Convex function.
   *
   * The return type is a Convex-registered function type that is only
   * callable from within Convex.
   *
   * @returns A Convex-registered function with internal visibility.
   */
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

  /**
   * Registers the function with Convex using the given visibility.
   *
   * @param visibility - Whether the function should be `public` or `internal`.
   * @returns The Convex-registered function.
   * @private
   */
  private _register(functionVisibility: FunctionVisibility): any {
    const { functionType, argsValidator, returnsValidator, handler, middlewares } = this.def;

    if (!functionType) {
      throw new Error("Function type not set. Call .query(), .mutation(), or .action() first.");
    }

    if (!handler) {
      throw new Error("Handler not set. Call .handler() before .public() or .internal().");
    }

    /**
     * Compose the handler with all middlewares using onion composition.
     * Each middleware's `next()` executes the rest of the chain (subsequent
     * middleware + handler), enabling try/catch, timing, and post-processing.
     *
     * @param baseCtx - The base context.
     * @param baseArgs - The base arguments.
     * @returns The composed handler.
     */
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
