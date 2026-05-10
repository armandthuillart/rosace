"use node";

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
    return execFileSync(
      "vp",
      [
        "exec",
        "--filter",
        "./packages/convex",
        "--",
        "convex",
        "env",
        "get",
        ...(prod ? ["--prod"] : []),
        name,
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
  } catch {
    return "";
  }
}

function setEnv(name: string, value: string, prod = false): void {
  execFileSync(
    "vp",
    [
      "exec",
      "--filter",
      "./packages/convex",
      "--",
      "convex",
      "env",
      "set",
      ...(prod ? ["--prod"] : []),
      "--",
      name,
      value,
    ],
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
    public: { keys: [{ ...publicJwk, kid, use: "sig", alg: "RS256" }] },
    private: { ...privateJwk, kid, use: "sig", alg: "RS256" },
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
    .description("Set JWKS if missing.")
    .option("--prod", "Set in production deployment.")
    .action(async ({ prod }: Options) => {
      const isProd = Boolean(prod);

      if (deps.getEnv("JWKS", isProd) === "") {
        deps.setEnv("JWKS", await deps.createJwks(), isProd);
        console.info(`✔ Set JWKS.`);
      } else {
        console.info(`✔ JWKS already set.`);
      }
    });

  program
    .command("rotate")
    .description("Rotate JWKS.")
    .option("--prod", "Rotate in production deployment.")
    .action(async ({ prod }: Options) => {
      const isProd = Boolean(prod);

      deps.setEnv("JWKS", await deps.createJwks(), isProd);
      console.info(`✔ Rotated JWKS.`);
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
