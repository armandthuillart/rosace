import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";

import { Command } from "commander";
import { generateKeyPair, exportJWK } from "jose";

type Options = { prod?: boolean };

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

    if (getEnv("AUTH_SECRET", isProd) === "") {
      setEnv("AUTH_SECRET", randomBytes(32).toString("hex"), isProd);
      console.info(`✔ Set "AUTH_SECRET"`);
    } else {
      console.info(`✔ "AUTH_SECRET" already set`);
    }

    if (getEnv("AUTH_JWKS", isProd) === "") {
      setEnv("AUTH_JWKS", await createJwks(), isProd);
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

    setEnv("AUTH_SECRET", randomBytes(32).toString("hex"), isProd);
    console.info(`✔ Rotated "AUTH_SECRET"`);

    setEnv("AUTH_JWKS", await createJwks(), isProd);
    console.info(`✔ Rotated "AUTH_JWKS"`);
  });

await program.parseAsync(process.argv);
