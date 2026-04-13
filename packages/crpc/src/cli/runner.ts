#!/usr/bin/env bun

import { z } from "zod";

import { syncEnv } from "./sync";

const HELP = `
Usage:
  crpc dev
      Start the local development server.

  crpc deploy
      Deploy your project to production.

  crpc env list [--prod]
      List environment variables. Use --prod for production.

  crpc env set <name> <value> [--prod]
      Set an environment variable. Use --prod for production.

  crpc env rm <name> [--prod]
      Remove an environment variable. Use --prod for production.

  crpc env sync [--auth] [--prod] [--reset]
      Sync environment variables.
      --auth    Generate or update authentication secrets.
      --prod    Apply to production environment.
      --reset   Re-push all variables and regenerate JWKS even when they already match.

`;

const commandSchema = z.enum(["dev", "deploy", "env", "gen", "help"]).default("help");

const subcommandSchema = z.enum(["list", "set", "rm", "remove", "sync"]);

let codegenPromise: Promise<typeof import("./codegen")> | undefined;

function loadCodegen(): Promise<typeof import("./codegen")> {
  codegenPromise ??= import("./codegen");
  return codegenPromise;
}

async function run(args: string[]): Promise<number> {
  const [first, second, ...rest] = args;

  const command = commandSchema.parse(first);

  if (command === "gen") {
    const { build } = await loadCodegen();
    await build();
    return 0;
  }

  if (command === "dev") {
    const { watch } = await loadCodegen();
    await watch();
    return 0;
  }

  if (command === "env") {
    const { data: subcommand, error } = subcommandSchema.safeParse(second);

    if (error) {
      console.info(HELP);
      return 1;
    }

    if (subcommand === "sync") {
      await syncEnv({
        auth: rest.includes("--auth"),
        prod: rest.includes("--prod"),
        reset: rest.includes("--reset"),
      });

      return 0;
    }

    const { runConvex } = await loadCodegen();
    await runConvex(["env", subcommand, ...rest]);
    return 0;
  }

  if (command === "deploy") {
    const { deploy } = await loadCodegen();
    await deploy();
    return 0;
  }

  if (command === "help") {
    console.info(HELP);
    return 0;
  }

  return 0;
}

if (import.meta.main) {
  try {
    const code = await run(process.argv.slice(2));
    process.exitCode = code;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

export { run };
