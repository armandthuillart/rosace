import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const envs = {
  dev: parseEnv(readFileSync(join(root, ".env.development"), "utf8")),
  prod: parseEnv(readFileSync(join(root, ".env.production"), "utf8")),
};

const KEYS = {
  dashboard: ["CONVEX_SITE_URL", "MARKETING_URL"],
  marketing: ["DASHBOARD_URL", "MARKETING_URL"],
} as const;

const targets = [
  {
    file: "apps/dashboard/.env.development",
    from: "dev",
    keys: KEYS.dashboard,
    prefix: { MARKETING_URL: "PUBLIC_" },
  },
  {
    file: "apps/dashboard/.env.production",
    from: "prod",
    keys: KEYS.dashboard,
    prefix: { MARKETING_URL: "PUBLIC_" },
  },
  {
    file: "apps/marketing/.env.development",
    from: "dev",
    keys: KEYS.marketing,
    prefix: {},
  },
  {
    file: "apps/marketing/.env.production",
    from: "prod",
    keys: KEYS.marketing,
    prefix: {},
  },
] as const;


for (const { file, from, keys, prefix } of targets) {
  const content = `${keys
    .map((key) => `${(prefix[key as keyof typeof prefix] ?? "") + key}=${envs[from][key] ?? ""}`)
    .join("\n")}\n`;
  writeFileSync(join(root, file), content, "utf8");
}

const files = targets.map((t) => t.file);

console.info("¤ Preparing environment files\n");
for (const file of files) console.info(`- ${file}`);
console.info(`\n✓ Prepared ${files.length} environment files`);
