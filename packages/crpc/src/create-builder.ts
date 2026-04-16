import type { GenericDataModel } from "convex/server";
import { ConvexBuilder } from "./factory";

function createBuilder<TDataModel extends GenericDataModel>(): ConvexBuilder<TDataModel> {
  return new ConvexBuilder<TDataModel>({
    middlewares: [],
  });
}

export { createBuilder };
