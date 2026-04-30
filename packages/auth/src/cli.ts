import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";

import { Command } from "commander";
import { generateKeyPair, exportJWK } from "jose";

type Options = { prod?: boolean };
type Deps = {
  createJwks: () => Promise<string>;
  getEnv: (name: string, prod?: boolean) => string;
  randomSecret: () => string;
  setEnv: (name: string, value: string, prod?: boolean) => void;
};

function getEnv(name: string, prod = false): string {
  try {
    return execFileSync("vp", ["exec", "convex", "env", "get", ...(prod ? ["--prod"] : []), name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function setEnv(name: string, value: string, prod = false): void {
  execFileSync(
    "vp",
    ["exec", "convex", "env", "set", ...(prod ? ["--prod"] : []), "--", name, value],
    { stdio: "inherit" },
  );
}

async function createJwks() {
  const kid = randomUUID();

  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });

  const [publicJwk, privateJwk] = await Promise.all([exportJWK(publicKey), exportJWK(privateKey)]);

  return JSON.stringify({
    kid,
    publicJwks: {
      keys: [{ ...publicJwk, kid, use: "sig", alg: "RS256" }],
    },
    privateJwk: { ...privateJwk, kid, use: "sig", alg: "RS256" },
  });
}

function randomSecret() {
  return randomBytes(32).toString("hex");
}

function defaultDeps(): Deps {
  return {
    createJwks,
    getEnv,
    randomSecret,
    setEnv,
  };
}

function buildProgram(deps: Deps): Command {
  const program = new Command()
    .name("auth")
    .description("Manage authentication environment variables.")
    .showHelpAfterError();

  program
    .command("set")
    .description("Set AUTH_SECRET and AUTH_JWKS if they are missing.")
    .option("--prod", "Set variables in production deployment.")
    .action(async ({ prod }: Options) => {
      const isProd = Boolean(prod);

      if (deps.getEnv("AUTH_SECRET", isProd) === "") {
        deps.setEnv("AUTH_SECRET", deps.randomSecret(), isProd);
        console.info(`✔ Set "AUTH_SECRET"`);
      } else {
        console.info(`✔ "AUTH_SECRET" already set`);
      }

      if (deps.getEnv("AUTH_JWKS", isProd) === "") {
        deps.setEnv("AUTH_JWKS", await deps.createJwks(), isProd);
        console.info(`✔ Set "AUTH_JWKS"`);
      } else {
        console.info(`✔ "AUTH_JWKS" already set`);
      }
    });

  program
    .command("rotate")
    .description("Rotate AUTH_SECRET and AUTH_JWKS.")
    .option("--prod", "Rotate variables in production deployment.")
    .action(async ({ prod }: Options) => {
      const isProd = Boolean(prod);

      deps.setEnv("AUTH_SECRET", deps.randomSecret(), isProd);
      console.info(`✔ Rotated "AUTH_SECRET"`);

      deps.setEnv("AUTH_JWKS", await deps.createJwks(), isProd);
      console.info(`✔ Rotated "AUTH_JWKS"`);
    });

  return program;
}

async function run(argv = process.argv, deps: Deps = defaultDeps()) {
  await buildProgram(deps).parseAsync(argv);
}

if (import.meta.main) {
  await run();
}

export { buildProgram, createJwks, run };
