type Operator =
  | "contains"
  | "ends_with"
  | "eq"
  | "gt"
  | "gte"
  | "in"
  | "lt"
  | "lte"
  | "ne"
  | "not_in"
  | "starts_with";

type Where = {
  connector?: "AND" | "OR";
  field: string;
  operator?: Operator;
  value: unknown;
};

type Sort = {
  direction: "asc" | "desc";
  field: string;
};

type CreateInput = {
  table: string;
  data: Record<string, unknown>;
  select?: string[];
};

type FindOneInput = {
  table: string;
  where?: Where[];
  select?: string[];
};

type FindManyInput = {
  table: string;
  where?: Where[];
  sortBy?: Sort;
  limit?: number;
  offset?: number;
  select?: string[];
};

type UpdateOneInput = {
  table: string;
  where?: Where[];
  update: Record<string, unknown>;
  select?: string[];
};

type UpdateManyInput = {
  table: string;
  where?: Where[];
  update: Record<string, unknown>;
};

type DeleteOneInput = {
  table: string;
  where?: Where[];
};

type DeleteManyInput = {
  table: string;
  where?: Where[];
};

type CountInput = {
  table: string;
  where?: Where[];
};

const operations = {
  count: "query",
  create: "mutation",
  deleteMany: "mutation",
  deleteOne: "mutation",
  findMany: "query",
  findOne: "query",
  updateMany: "mutation",
  updateOne: "mutation",
} as const;

type OperationName = keyof typeof operations;

export {
  operations,
  type CountInput,
  type CreateInput,
  type DeleteManyInput,
  type DeleteOneInput,
  type FindManyInput,
  type FindOneInput,
  type OperationName,
  type Operator,
  type Sort,
  type UpdateManyInput,
  type UpdateOneInput,
  type Where,
};
