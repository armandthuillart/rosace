import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";

type QueryCtx<DataModel extends GenericDataModel = GenericDataModel> = GenericQueryCtx<DataModel>;
type MutationCtx<DataModel extends GenericDataModel = GenericDataModel> =
  GenericMutationCtx<DataModel>;
type ActionCtx<DataModel extends GenericDataModel = GenericDataModel> = GenericActionCtx<DataModel>;

type CtxKind = "query" | "mutation" | "action";

function to<DataModel extends GenericDataModel>(
  kind: "query",
  ctx: ActionCtx<DataModel>,
): QueryCtx<DataModel>;
function to<DataModel extends GenericDataModel>(
  kind: "mutation",
  ctx: ActionCtx<DataModel>,
): MutationCtx<DataModel>;
function to<DataModel extends GenericDataModel>(
  kind: "action",
  ctx: ActionCtx<DataModel>,
): ActionCtx<DataModel>;
function to<DataModel extends GenericDataModel>(kind: CtxKind, ctx: ActionCtx<DataModel>) {
  switch (kind) {
    case "query":
      return ctx as unknown as QueryCtx<DataModel>;
    case "mutation":
      return ctx as unknown as MutationCtx<DataModel>;
    case "action":
      return ctx;
  }
}

export { to };
