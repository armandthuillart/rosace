import { z } from "zod";
import { CRPCError } from "./crpc-error";

type EnvKey = string;
type EnvObject = Record<EnvKey, EnvValue>;
type EnvValue = string | undefined;
type EnvSchema = z.ZodObject<z.ZodRawShape>;

type GlobalThis = Record<string, unknown> & { __CRPC_CODEGEN__?: boolean };

interface CreateEnvOptions<TSchema extends EnvSchema> {
  envSchema: TSchema;
}

/**
 * Provides dummy env values during codegen.
 *
 * @param schema - The Zod schema to generate placeholder values for.
 * @returns A record of placeholder values for the schema.
 */
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

/**
 * Returns a getter for typed, validated env. Parses once and caches.
 *
 * @example
 * ```ts
 * const envSchema = z.object({
 *   API_KEY: z.string(),
 * });
 *
 * const getEnv = createEnv({
 *   envSchema,
 * });
 *
 * console.log(getEnv().API_KEY);
 * ```
 */
export function createEnv<TSchema extends EnvSchema>({ envSchema }: CreateEnvOptions<TSchema>) {
  type Env = z.infer<TSchema>;

  let cachedEnv: Env | undefined;

  return () => {
    if (cachedEnv) {
      return cachedEnv;
    }

    const _globalThis = globalThis as GlobalThis;

    /**
     * Bundlers treat `process.env` specially: they replace it at build time with static values or inject polyfill.
     * This obfuscates it from the bundler, the time the codegen runs.
     *
     * @returns The obfuscated environment.
     */
    function obfuscateEnv(): EnvObject | undefined {
      const processObj = _globalThis[["pro", "cess"].join("")] as { env: EnvObject } | undefined;

      return processObj?.env;
    }

    function getEnv(key: EnvKey): EnvValue {
      return obfuscateEnv()?.[key];
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
      /**
       * Format the error messages for the client.
       *
       * @example
       * ```
       * Invalid or missing environment variables:
       *   - API_KEY: This field is required.
       *   - API_URL: This field is required.
       * ```
       */
      const missingOrInvalid = parsedEnv.error.issues
        .map((issue) => {
          const key = issue.path.join(".") || "env";
          return `  - ${key}: ${issue.message}`;
        })
        .join("\n");

      throw new CRPCError({
        code: "PARSE_ERROR",
        message: `Invalid or missing environment variables:\n${missingOrInvalid}`,
      });
    }

    cachedEnv = parsedEnv.data;
    return cachedEnv;
  };
}
