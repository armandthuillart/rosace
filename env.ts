import fs from "node:fs";
import path from "node:path";

const APP_PATHS: Record<string, string> = {
  dashboard: "apps/dashboard",
  marketing: "apps/marketing",
};

const repo = import.meta.dirname;
const mode = process.env.NODE_ENV === "production" ? "production" : "development";

const cwd = process.cwd();

const appFromCwd = Object.entries(APP_PATHS).find(([, appPath]) =>
  cwd.includes(path.normalize(appPath)),
)?.[0];

const projectId = appFromCwd;

const apps = projectId && APP_PATHS[projectId] ? [APP_PATHS[projectId]] : Object.values(APP_PATHS);

const source = path.join(repo, `.env.${mode}`);

if (!fs.existsSync(source)) {
  console.warn(`.env.${mode} is required to run the app`);
  process.exit(0);
}

for (const app of apps) {
  const target = path.join(repo, app, `.env.${mode}`);
  const appName = path.basename(app);
  const alreadyExists = fs.existsSync(target);

  if (alreadyExists) {
    console.info(`.env.${mode} already defined for ${appName}`);
  }

  if (!alreadyExists && appName === "marketing") {
    const rawEnv = fs.readFileSync(source, "utf8");

    const marketingEnv = rawEnv
      .split("\n")
      .filter((line) => !line.trim().startsWith("CONVEX_"))
      .join("\n");

    fs.writeFileSync(target, marketingEnv, "utf8");
    console.info(`Created .env.${mode} for the ${appName} app`);
  }

  if (!alreadyExists && appName === "dashboard") {
    const rawEnv = fs.readFileSync(source, "utf8");

    const dashboardEnv = rawEnv
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
          return line;
        }

        const idx = line.indexOf("=");

        if (idx === -1) {
          return line;
        }

        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1);

        return `PUBLIC_${key}=${value}`;
      })
      .join("\n");

    fs.writeFileSync(target, dashboardEnv, "utf8");
    console.info(`Created .env.${mode} for the ${appName} app`);
  }
}
