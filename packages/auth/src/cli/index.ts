#!/usr/bin/env bun

import { rotateAuthEnv, setAuthEnv } from "./handle-env";

function printUsage() {
  console.info(
    [
      "Usage:",
      "  auth set [--prod]",
      "  auth rotate [--prod]",
      "",
      "Examples:",
      "  auth set",
      "  auth set --prod",
      "  auth rotate",
      "  auth rotate --prod",
    ].join("\n"),
  );
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const prod = rest.includes("--prod");

  if (cmd === "set") return setAuthEnv({ prod });
  if (cmd === "rotate") return rotateAuthEnv({ prod });

  printUsage();
  process.exitCode = 1;
}

await main();
