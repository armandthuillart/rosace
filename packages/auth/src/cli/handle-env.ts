import { execSync } from "node:child_process";

import { generateAuthJwks, generateSecret } from "./crypto";

type Options = {
  prod: boolean;
};

const AUTH_SECRET = "AUTH_SECRET";
const AUTH_JWKS = "AUTH_JWKS";

function prodFlag(prod: boolean): string {
  return prod ? "--prod" : "";
}

function shellEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}

function getEnvVar(name: string, prod: boolean): string {
  try {
    return execSync(`vp exec convex env get ${prodFlag(prod)} ${name}`.trim(), {
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  } catch {
    return "";
  }
}

function setEnvVar(name: string, value: string, prod: boolean): void {
  const escaped = shellEscape(value);
  execSync(`vp exec convex env set ${prodFlag(prod)} -- ${name} "${escaped}"`.trim(), {
    stdio: "inherit",
  });
}

function setIfMissing(name: string, value: string, prod: boolean): boolean {
  const current = getEnvVar(name, prod);
  if (current !== "") return false;
  setEnvVar(name, value, prod);
  return true;
}

async function setAuthEnv(options: Options): Promise<void> {
  const secretCreated = setIfMissing(AUTH_SECRET, generateSecret(), options.prod);
  console.info(secretCreated ? `✔ Set ${AUTH_SECRET}` : `✔ ${AUTH_SECRET} already set`);

  const jwks = await generateAuthJwks();
  const jwksCreated = setIfMissing(AUTH_JWKS, jwks.authJwks, options.prod);
  console.info(jwksCreated ? `✔ Set ${AUTH_JWKS}` : `✔ ${AUTH_JWKS} already set`);
}

async function rotateAuthEnv(options: Options): Promise<void> {
  setEnvVar(AUTH_SECRET, generateSecret(), options.prod);
  console.info(`✔ Rotated ${AUTH_SECRET}`);

  const jwks = await generateAuthJwks();
  setEnvVar(AUTH_JWKS, jwks.authJwks, options.prod);
  console.info(`✔ Rotated ${AUTH_JWKS}`);
}

export { rotateAuthEnv, setAuthEnv };
