import type { GenericDataModel } from "convex/server";
import type { GenericValidator, PropertyValidators } from "convex/values";

import { ConvexBuilderWithHandler } from "./factory-handler";
import type {
  AnyConvexMiddleware,
  CallableBuilder,
  Context,
  ConvexArgsValidator,
  ConvexBuilderDef,
  ConvexMiddleware,
  ConvexReturnsValidator,
  EmptyObject,
  FunctionType,
  InferredArgs,
  InferredHandlerReturn,
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

export { ConvexBuilderWithFunction };
