import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { symmetricEncrypt } from "better-auth/crypto";
import { exportJWK, generateKeyPair } from "jose";

import {
  getConvexEnvVar,
  listConvexEnvVars,
  setConvexEnvVar,
  setConvexEnvVarFromFile,
} from "./convex-env";

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

interface SyncEnvOptions {
  auth?: boolean;
  prod?: boolean;
  reset?: boolean;
}

const BUILT_IN_CONVEX_ENV_VARS = new Set(["CONVEX_SITE_URL", "CONVEX_URL"]);

function findWorkspaceRoot(cwd: string): string {
  let currentDir = resolve(cwd);

  for (;;) {
    if (existsSync(join(currentDir, ".git"))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      return cwd;
    }

    currentDir = parentDir;
  }
}

function getConvexCwd(cwd = process.cwd()): string {
  return resolve(findWorkspaceRoot(cwd), "packages", "convex");
}

function generateSecret(): string {
  return execSync("openssl rand -base64 32", { encoding: "utf8" }).trim();
}

function ensureAuthEnvVars(envVars: Record<string, string>, options: SyncEnvOptions): void {
  if (!options.auth) {
    return;
  }
  if (envVars.BETTER_AUTH_SECRET) {
    return;
  }

  try {
    const secret = generateSecret();
    envVars.BETTER_AUTH_SECRET = secret;
  } catch {
    throw new Error("Could not generate BETTER_AUTH_SECRET.");
  }
}

async function buildStaticJwksJson(secret: string): Promise<string> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const publicWebKey = await exportJWK(publicKey);
  const privateWebKey = await exportJWK(privateKey);
  const stringifiedPrivate = JSON.stringify(privateWebKey);
  const jwk = {
    alg: "RS256" as const,
    publicKey: JSON.stringify(publicWebKey),
    privateKey: JSON.stringify(await symmetricEncrypt({ key: secret, data: stringifiedPrivate })),
    createdAt: new Date(),
    id: randomUUID(),
  };
  return JSON.stringify([jwk]);
}

async function syncJwks(
  options: SyncEnvOptions = {},
  betterAuthSecretFromSync: string | undefined,
  cwd: string = process.cwd(),
): Promise<void> {
  if (!options.auth) {
    return;
  }

  const convexOpts = { prod: options.prod };
  const currentJwks = (await getConvexEnvVar("JWKS", convexOpts, cwd))?.trim();

  if (!options.reset && currentJwks && currentJwks !== "undefined") {
    try {
      JSON.parse(currentJwks);
      console.log("✔ JWKS is already set and valid");
      return;
    } catch {}
  }

  const secret = betterAuthSecretFromSync?.trim();
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is required to generate JWKS. With --auth it must be in your env file or generated in this run.",
    );
  }

  await setConvexEnvVarFromFile("JWKS", await buildStaticJwksJson(secret), convexOpts, cwd);
}

export async function syncEnv(options: SyncEnvOptions = {}): Promise<string> {
  const cwd = process.cwd();
  const workspaceRoot = findWorkspaceRoot(cwd);
  const convexCwd = getConvexCwd(cwd);
  const envPath = join(workspaceRoot, options.prod ? ".env.production" : ".env.development");

  if (!existsSync(envPath)) {
    throw new Error(`Missing env file: ${envPath}`);
  }
  const envVars = parseEnv(readFileSync(envPath, "utf8"));
  const currentEnvVars = await listConvexEnvVars({ prod: options.prod }, convexCwd);
  const deployEnv = options.prod ? "production" : "development";
  if (!envVars.DEPLOY_ENV) {
    envVars.DEPLOY_ENV = deployEnv;
  }
  ensureAuthEnvVars(envVars, options);

  for (const [name, rawValue] of Object.entries(envVars)) {
    if (BUILT_IN_CONVEX_ENV_VARS.has(name)) {
      continue;
    }

    const value = String(rawValue);

    if (!value) {
      continue;
    }

    if (!options.reset && currentEnvVars.get(name) === value) {
      continue;
    }

    await setConvexEnvVar(name, value, { prod: options.prod }, convexCwd);
  }

  const secretForJwks =
    envVars.BETTER_AUTH_SECRET != null ? String(envVars.BETTER_AUTH_SECRET) : undefined;
  await syncJwks(options, secretForJwks, convexCwd);
  return envPath;
}
