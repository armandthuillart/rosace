import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { parse } from "dotenv";

interface SyncEnvOptions {
  auth?: boolean;
  force?: boolean;
  prod?: boolean;
}

const BUILT_IN_CONVEX_ENV_VARS = new Set(["CONVEX_SITE_URL", "CONVEX_URL"]);

const getBunxCommand = () => (process.platform === "win32" ? "bunx.cmd" : "bunx");

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

async function runConvex(args: string[], cwd = process.cwd()): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(getBunxCommand(), ["convex", ...args], {
      cwd,
      stdio: "inherit",
    });

    child.on("error", rejectPromise);

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(0);
        return;
      }
      rejectPromise(new Error(`convex ${args.join(" ")} failed with exit code ${code ?? -1}`));
    });
  });
}

async function listConvexEnvVars(options: SyncEnvOptions = {}): Promise<Map<string, string>> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      getBunxCommand(),
      ["convex", "env", "list", ...(options.prod ? ["--prod"] : [])],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] },
    );

    let stdout = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.on("error", rejectPromise);

    child.on("exit", (code) => {
      if (code === 0) {
        const envMap = new Map<string, string>();

        for (const line of stdout.split(/\r?\n/u)) {
          if (line) {
            const sep = line.indexOf("=");

            if (sep !== -1) {
              envMap.set(line.slice(0, sep), line.slice(sep + 1));
            }
          }
        }

        resolvePromise(envMap);
        return;
      }

      rejectPromise(new Error(`convex env list failed with exit code ${code ?? -1}`));
    });
  });
}

async function setConvexEnvVar(
  name: string,
  value: string,
  options: SyncEnvOptions = {},
): Promise<void> {
  await runConvex(["env", "set", name, value, ...(options.prod ? ["--prod"] : [])], process.cwd());
}

function generateSecret(): string {
  return execSync("openssl rand -base64 32", { encoding: "utf8" }).trim();
}

function normalizeJwksValue(value: string | undefined): string | undefined {
  if (!value) {
    return;
  }

  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return value.trim() || undefined;
  }
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

async function syncJwks(options: SyncEnvOptions = {}): Promise<void> {
  if (!options.auth) {
    return;
  }

  const currentEnvVars = await listConvexEnvVars(options);
  const currentJwk = currentEnvVars.get("JWK");

  if (!options.force && currentJwk && currentJwk !== "undefined") {
    return;
  }

  let generatedJwks: string | undefined;

  try {
    generatedJwks = normalizeJwksValue(
      execSync(
        `${getBunxCommand()} convex run crpc/auth:getLatestJwk${options.prod ? " --prod" : ""}`,
        {
          cwd: process.cwd(),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      ),
    );
  } catch {
    generatedJwks = undefined;
  }

  if (!generatedJwks) {
    return;
  }

  await setConvexEnvVar("JWK", generatedJwks, options);
}

export async function syncEnv(options: SyncEnvOptions = {}): Promise<string> {
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  const envPath = join(workspaceRoot, options.prod ? ".env.production" : ".env.development");
  if (!existsSync(envPath)) {
    throw new Error(`Missing env file: ${envPath}`);
  }
  const envVars = parse(readFileSync(envPath, "utf8"));
  const currentEnvVars = await listConvexEnvVars(options);
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

    if (!options.force && currentEnvVars.get(name) === value) {
      continue;
    }

    await setConvexEnvVar(name, value, options);
  }
  await syncJwks(options);
  return envPath;
}
