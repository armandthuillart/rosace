import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "dotenv";

const rootDir = dirname(fileURLToPath(import.meta.url));

function readEnv(filename: string) {
  const path = join(rootDir, filename);
  return parse(readFileSync(path, "utf8"));
}

function formatEnv(entries: Array<[string, string]>) {
  return `${entries.map(([key, value]) => `${key}=${value}`).join("\n")}\n`;
}

function writeEnv(filename: string, entries: Array<[string, string]>) {
  writeFileSync(join(rootDir, filename), formatEnv(entries), "utf8");
}

function pick(source: Record<string, string>, keys: string[]) {
  return keys.map((key) => [key, source[key]] as [string, string]);
}

function prefix(source: Record<string, string>, keys: string[], prefixValue: string) {
  return keys.map((key) => [`${prefixValue}${key}`, source[key]] as [string, string]);
}

function ensureKeys(source: Record<string, string>, keys: string[], sourceName: string) {
  const missing = keys.filter((key) => !source[key]);

  if (missing.length > 0) {
    throw new Error(`Missing ${sourceName} keys: ${missing.join(", ")}`);
  }
}

const development = readEnv(".env.development");
const production = readEnv(".env.production");

const dashboardKeys = ["CONVEX_URL", "CONVEX_SITE_URL", "DASHBOARD_URL", "MARKETING_URL"];
const marketingKeys = ["DASHBOARD_URL", "MARKETING_URL"];

ensureKeys(development, dashboardKeys, ".env.development");
ensureKeys(production, dashboardKeys, ".env.production");

writeEnv("apps/dashboard/.env.development", prefix(development, dashboardKeys, "PUBLIC_"));
writeEnv("apps/marketing/.env.development", pick(development, marketingKeys));
writeEnv("apps/marketing/.env.production", pick(production, marketingKeys));

console.info("Prepared app env files");
