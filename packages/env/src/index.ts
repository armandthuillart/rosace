import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  CONVEX_SITE_URL: z.string().optional(),
  CONVEX_URL: z.string().optional(),
  DASHBOARD_URL: z.string(),
  MARKETING_URL: z.string(),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

function resolveEnvPath(filename: string): string {
  const rootDir = parse(process.cwd()).root;
  let currentDir = process.cwd();

  while (true) {
    const candidatePath = join(currentDir, filename);
    if (existsSync(candidatePath)) {
      return candidatePath;
    }

    if (currentDir === rootDir) {
      return filename;
    }

    currentDir = dirname(currentDir);
  }
}

function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const target = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
  const envPath = resolveEnvPath(target);

  loadEnv({
    path: envPath,
    quiet: true,
  });

  cachedEnv = envSchema.parse({
    CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
    CONVEX_URL: process.env.CONVEX_URL,
    DASHBOARD_URL: process.env.DASHBOARD_URL,
    MARKETING_URL: process.env.MARKETING_URL,
  });

  return cachedEnv;
}

export { type Env, getEnv };
