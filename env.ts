import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "dotenv";

const root = dirname(fileURLToPath(import.meta.url));

const envs = {
  dev: parse(readFileSync(join(root, ".env.development"), "utf8")),
  prod: parse(readFileSync(join(root, ".env.production"), "utf8")),
};

const KEYS = {
  dashboard: ["CONVEX_URL", "CONVEX_SITE_URL", "DASHBOARD_URL", "MARKETING_URL"],
  marketing: ["DASHBOARD_URL", "MARKETING_URL"],
} as const;

const targets = [
  { file: "apps/dashboard/.env.development", from: "dev", keys: KEYS.dashboard, prefix: "PUBLIC_" },
  { file: "apps/marketing/.env.development", from: "dev", keys: KEYS.marketing, prefix: "" },
  { file: "apps/marketing/.env.production", from: "prod", keys: KEYS.marketing, prefix: "" },
] as const;

for (const { file, from, keys, prefix } of targets) {
  const content = `${keys.map((k) => `${prefix}${k}=${envs[from][k]}`).join("\n")}\n`;
  writeFileSync(join(root, file), content, "utf8");
}

const files = targets.map((t) => t.file);

console.info("¤ Preparing environment files\n");
for (const file of files) console.info(`- ${file}`);
console.info(`\n✓ Prepared ${files.length} environment files`);
