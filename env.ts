import fs from "node:fs";
import path from "node:path";

const repo = import.meta.dirname;
const mode = process.env.NODE_ENV === "production" ? "production" : "development";
const source = path.join(repo, `.env.${mode}`);

if (!fs.existsSync(source)) {
  throw new Error(`Missing ${source}`);
}

const raw = fs.readFileSync(source, "utf8");

function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }

  return out;
}

if (mode === "production") {
  const env = parseEnv(raw);
  const required = ["CONVEX_URL", "CONVEX_SITE_URL", "DASHBOARD_URL", "MARKETING_URL"] as const;
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required keys in ${source}: ${missing.join(", ")}`);
  }

  console.info(`Using ${source}`);
  process.exit(0);
}

const dashboardEnv = raw
  .split("\n")
  .map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const idx = line.indexOf("=");
    if (idx === -1) return line;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    return `PUBLIC_${key}=${value}`;
  })
  .join("\n");

const marketingEnv = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("CONVEX_"))
  .join("\n");

fs.writeFileSync(path.join(repo, "apps/dashboard/.env.development"), dashboardEnv, "utf8");
fs.writeFileSync(path.join(repo, "apps/marketing/.env.development"), marketingEnv, "utf8");

console.info("Generated apps/dashboard/.env.development");
console.info("Generated apps/marketing/.env.development");
