#!/usr/bin/env bun

import { z } from "zod";
import { build, deploy, runConvex, sync, watch } from "./codegen";

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

  crpc env sync [--auth] [--force] [--prod]
      Sync environment variables.
      --auth    Generate or update authentication secrets.
      --prod    Apply to production environment.
      --force   Force update of environment variables.

`;

const commandSchema = z
	.enum(["dev", "deploy", "env", "gen", "help"])
	.default("help");

const subcommandSchema = z.enum(["list", "set", "rm", "remove", "sync"]);

async function run(args: string[]): Promise<number> {
	const [first, second, ...rest] = args;

	const command = commandSchema.parse(first);

	if (command === "gen") {
		await build();
		return 0;
	}

	if (command === "dev") {
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
			await sync({
				auth: rest.includes("--auth"),
				prod: rest.includes("--prod"),
			});

			return 0;
		}

		await runConvex(["env", subcommand, ...rest]);
		return 0;
	}

	if (command === "deploy") {
		await deploy();
		return 0;
	}

	if (command === "help") {
		console.info(HELP);
		return 0;
	}

	return 0;
}

run(process.argv.slice(2))
	.then((code) => {
		process.exitCode = code;
	})
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});

export { run };
