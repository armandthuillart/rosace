import type { GenericDataModel } from "convex/server";
import { ConvexBuilderWithFunction } from "./factory.function";
import type {
	ActionCtx,
	Context,
	ConvexBuilderDef,
	ConvexMiddleware,
	EmptyObject,
	MutationCtx,
	QueryCtx,
} from "./types";

/**
 * Entry-point builder for defining Convex functions.
 *
 * Use {@link query}, {@link mutation}, or {@link action} to start a function
 * chain, then {@link ConvexBuilderWithFunction.use}, {@link ConvexBuilderWithFunction.input},
 * {@link ConvexBuilderWithFunction.returns}, and {@link ConvexBuilderWithFunction.handler} to
 * configure and register the function.
 *
 * @typeParam TDataModel - The Convex data model (defaults to `GenericDataModel`).
 */
class ConvexBuilder<TDataModel extends GenericDataModel = GenericDataModel> {
	protected def: ConvexBuilderDef;

	/**
	 * Creates a new Convex builder with the given definition.
	 *
	 * @param def - Internal builder definition (function type, validators, middleware, etc.).
	 */
	constructor(def: ConvexBuilderDef) {
		this.def = def;
	}

	/**
	 * Starts defining a Convex query.
	 *
	 * @returns A builder for a query function (read-only, synchronous from Convex's perspective).
	 */
	query(): ConvexBuilderWithFunction<
		TDataModel,
		"query",
		QueryCtx<TDataModel>
	> {
		return new ConvexBuilderWithFunction<
			TDataModel,
			"query",
			QueryCtx<TDataModel>
		>({
			...this.def,
			functionType: "query",
		});
	}

	/**
	 * Starts defining a Convex mutation.
	 *
	 * @returns A builder for a mutation function (writes to the database).
	 */
	mutation(): ConvexBuilderWithFunction<
		TDataModel,
		"mutation",
		MutationCtx<TDataModel>
	> {
		return new ConvexBuilderWithFunction<
			TDataModel,
			"mutation",
			MutationCtx<TDataModel>
		>({
			...this.def,
			functionType: "mutation",
		});
	}

	/**
	 * Starts defining a Convex action.
	 *
	 * @returns A builder for an action function (can call external APIs, no direct DB access).
	 */
	action(): ConvexBuilderWithFunction<
		TDataModel,
		"action",
		ActionCtx<TDataModel>
	> {
		return new ConvexBuilderWithFunction<
			TDataModel,
			"action",
			ActionCtx<TDataModel>
		>({
			...this.def,
			functionType: "action",
		});
	}

	/**
	 * Type-helper for defining middleware that expects a specific input context.
	 *
	 * Use this when composing middleware that requires a known context shape (e.g. from
	 * {@link createMiddleware}). The returned object's `createMiddleware` is a no-op at
	 * runtime and only refines types.
	 *
	 * @typeParam U - The context type that the middleware expects as input.
	 * @returns An object with a typed `createMiddleware` helper.
	 */
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

	/**
	 * Type-helper that returns the middleware you pass in.
	 *
	 * Use with {@link ConvexBuilderWithFunction.use} to apply middleware to a function chain.
	 * This overload is for middleware that starts from an empty context.
	 *
	 * @typeParam UOutContext - The context type added by the middleware.
	 * @param middleware - The middleware function.
	 * @returns The same middleware (no runtime change).
	 */
	createMiddleware<UOutContext extends Context>(
		middleware: ConvexMiddleware<EmptyObject, UOutContext>,
	): ConvexMiddleware<EmptyObject, UOutContext>;

	/**
	 * Type-helper that returns the middleware you pass in.
	 *
	 * Use with {@link ConvexBuilderWithFunction.use} to apply middleware to a function chain.
	 * This overload is for middleware that transforms one context type into another.
	 *
	 * @typeParam UInContext - The context type the middleware receives.
	 * @typeParam UOutContext - The context type the middleware produces.
	 * @param middleware - The middleware function.
	 * @returns The same middleware (no runtime change).
	 */
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
