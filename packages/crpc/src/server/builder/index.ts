import type { GenericDataModel } from "convex/server";
import { ConvexBuilder } from "./factory";

/**
 * Chain .use(), .query(), .mutation(), .action(), .input(), .handler(), and returns().
 *
 * @typeParam TDataModel - Convex data model.
 * @returns A ConvexFactory instance.
 *
 * @example
 * ```typescript
 * const convex = createBuilder<DataModel>();
 *
 * export const myQuery = convex
 *   .query()
 *   .input(z.object({ id: v.id("user") }))
 *   .handler(async (ctx, { id }) => ctx.db.get(id))
 *   .public();
 * ```
 *
 * @see {@link ConvexBuilder}
 */
function createBuilder<
	TDataModel extends GenericDataModel,
>(): ConvexBuilder<TDataModel> {
	return new ConvexBuilder<TDataModel>({
		middlewares: [],
	});
}

export { createBuilder };
