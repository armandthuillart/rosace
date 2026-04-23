import * as v from "valibot";

import { ServerError } from "./server-error";

type EnvKey = string;
type EnvObject = Record<EnvKey, EnvValue>;
type EnvValue = string | undefined;

type GlobalThis = Record<string, unknown> & { __CRPC_CODEGEN__?: boolean };

interface OptionalSchemaDef {
  type: "optional";
  wrapped: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
  default: v.Default<v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>, undefined>;
}

interface PicklistSchemaDef {
  type: "picklist";
  options: v.PicklistOptions;
}

interface SchemaWithEntries {
  entries: Record<string, v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>;
}

function getFakeEnv(schema: SchemaWithEntries): Record<string, unknown> {
  const entries = schema.entries;

  return Object.fromEntries(
    Object.entries(entries).map(([envKey, fieldSchema]) => {
      const def = (fieldSchema as unknown as { _def: { type: string } })._def;

      if (def.type === "optional") {
        const optDef = def as OptionalSchemaDef;
        if (optDef.default !== undefined) {
          const fallback = v.getDefaults(optDef.wrapped);
          return [envKey, typeof fallback === "string" ? fallback : ""];
        }
        return [envKey, ""];
      }

      if (def.type === "picklist") {
        const pickDef = def as PicklistSchemaDef;
        return [envKey, pickDef.options[0]];
      }

      try {
        const parsed = v.parse(fieldSchema, undefined);
        return [envKey, typeof parsed === "string" ? parsed : ""];
      } catch {
        return [envKey, ""];
      }
    }),
  );
}

type InferEnvOutput<S extends SchemaWithEntries> = {
  [K in keyof S["entries"]]: v.InferOutput<S["entries"][K]>;
};

export function createEnv<const TSchema extends SchemaWithEntries>(opts: { envSchema: TSchema }) {
  type Env = InferEnvOutput<TSchema>;

  let cachedEnv: Env | undefined;

  return () => {
    if (cachedEnv) {
      return cachedEnv;
    }

    const _globalThis = globalThis as GlobalThis;

    function hideEnvFromConvex(): EnvObject | undefined {
      const processObj = _globalThis[["pro", "cess"].join("")] as { env: EnvObject } | undefined;

      return processObj?.env;
    }

    function getEnv(key: EnvKey): EnvValue {
      return hideEnvFromConvex()?.[key];
    }

    function hasSentinel(_globalThis: GlobalThis): boolean {
      return _globalThis.__CRPC_CODEGEN__ === true;
    }

    const envSchema = opts.envSchema;
    const entries = envSchema.entries;
    const envFromRuntime = Object.fromEntries(
      Object.keys(entries).map((key) => [key, getEnv(key)]),
    );

    const envForParse = hasSentinel(_globalThis)
      ? { ...getFakeEnv(envSchema), ...envFromRuntime }
      : envFromRuntime;

    const result = v.safeParse(
      envSchema as unknown as v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      envForParse,
    );

    if (result.issues) {
      const missingOrInvalid = result.issues
        .map((issue) => {
          const key = issue.path?.map((p: v.IssuePathItem) => p.key).join(".") || "env";
          return `  - ${key}: ${issue.message}`;
        })
        .join("\n");

      throw new ServerError({
        code: "PARSE_ERROR",
        message: `Invalid or missing environment variables:\n${missingOrInvalid}`,
      });
    }

    cachedEnv = result.output as unknown as Env;
    return cachedEnv;
  };
}
