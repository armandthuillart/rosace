import type { GenericDataModel } from "convex/server";

import type { ActionCtx } from "./types";

export declare function createAdapter<DataModel extends GenericDataModel = GenericDataModel>(
  ctx: ActionCtx<DataModel>,
): unknown;
