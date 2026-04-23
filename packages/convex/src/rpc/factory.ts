import type { GenericDataModel } from "convex/server";

import { ConvexBuilderWithFunction } from "./factory-function";
import type {
  ActionCtx,
  Context,
  ConvexBuilderDef,
  ConvexMiddleware,
  EmptyObject,
  MutationCtx,
  QueryCtx,
} from "./types";

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

export { ConvexBuilder };
