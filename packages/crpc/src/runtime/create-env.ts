import { z } from "zod";

import { ServerError } from "./errors";

type EnvKey = string;
type EnvObject = Record<EnvKey, EnvValue>;
type EnvValue = string | undefined;
type EnvSchema = z.ZodObject<z.ZodRawShape>;

type GlobalThis = Record<string, unknown> & { __CRPC_CODEGEN__?: boolean };

interface CreateEnvOptions<TSchema extends EnvSchema> {
  envSchema: TSchema;
}

function getFakeEnv(schema: EnvSchema): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema.shape).map(([envKey, zodType]) => {
      const parsed = (zodType as z.ZodType).safeParse(undefined);

      if (parsed.success) {
        const isString = typeof parsed.data === "string";
        const envValue = isString ? parsed.data : undefined;
        return [envKey, envValue];
      }

      const isEnum =
        zodType instanceof z.ZodEnum &&
        Array.isArray(zodType.options) &&
        zodType.options.length > 0;

      if (isEnum) {
        return [envKey, zodType.options[0]];
      }

      return [envKey, ""];
    }),
  );
}

export function createEnv<TSchema extends EnvSchema>({ envSchema }: CreateEnvOptions<TSchema>) {
  type Env = z.infer<TSchema>;

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

    const envFromRuntime = Object.fromEntries(
      Object.keys(envSchema.shape).map((key) => [key, getEnv(key)]),
    );

    const envForParse = hasSentinel(_globalThis)
      ? { ...getFakeEnv(envSchema), ...envFromRuntime }
      : envFromRuntime;

    const parsedEnv = envSchema.safeParse(envForParse);

    if (!parsedEnv.success) {
      const missingOrInvalid = parsedEnv.error.issues
        .map((issue) => {
          const key = issue.path.join(".") || "env";
          return `  - ${key}: ${issue.message}`;
        })
        .join("\n");

      throw new ServerError({
        code: "PARSE_ERROR",
        message: `Invalid or missing environment variables:\n${missingOrInvalid}`,
      });
    }

    cachedEnv = parsedEnv.data;
    return cachedEnv;
  };
}
