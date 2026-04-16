type Row = Record<string, unknown>;
type Mode = "one" | "many";
type Batch = { count: number; ids: string[] };

type CreateInput<T extends Row = Row> = {
  table: string;
  data: T;
  select?: string[];
};

type ReadInput = {
  mode: Mode;
  table: string;
  where?: unknown[];
  order?: { direction: "asc" | "desc"; field: string };
  limit?: number;
  select?: string[];
  offset?: number;
};

type UpdateInput = {
  mode: Mode;
  data: Row;
  select?: string[];
  table: string;
  where?: unknown[];
};

type RemoveInput = {
  mode: Mode;
  table: string;
  where?: unknown[];
};

type ReadOneInput = Omit<ReadInput, "mode"> & { mode: "one" };

type ReadManyInput = Omit<ReadInput, "mode"> & { mode: "many" };
type UpdateOneInput = Omit<UpdateInput, "mode"> & { mode: "one" };
type UpdateManyInput = Omit<UpdateInput, "mode"> & { mode: "many" };

type RemoveOneInput = Omit<RemoveInput, "mode"> & { mode: "one" };
type RemoveManyInput = Omit<RemoveInput, "mode"> & { mode: "many" };

function createCRUD() {
  async function create<T extends Row>(ctx: unknown, input: CreateInput<T>): Promise<T> {
    return input.data as T; // replace with real insert result later
  }

  async function read(ctx: unknown, input: ReadOneInput): Promise<Row | null>;
  async function read(ctx: unknown, input: ReadManyInput): Promise<Row[]>;
  async function read(ctx: unknown, input: ReadInput): Promise<Row | Row[] | null> {
    return null;
  }

  async function update(ctx: unknown, input: UpdateOneInput): Promise<Row | null>;
  async function update(ctx: unknown, input: UpdateManyInput): Promise<Batch>;
  async function update(ctx: unknown, input: UpdateInput): Promise<Row | Batch | null> {
    return null;
  }

  async function remove(ctx: unknown, input: RemoveOneInput): Promise<Row | null>;
  async function remove(ctx: unknown, input: RemoveManyInput): Promise<Batch>;
  async function remove(ctx: unknown, input: RemoveInput): Promise<Row | Batch | null> {
    return null;
  }

  return { create, read, update, remove };
}

export { createCRUD };
