import fs from "node:fs";
import path from "node:path";

const APP_PATHS: Record<string, string> = {
	dashboard: "apps/dashboard",
	marketing: "apps/marketing",
};

const repo = import.meta.dirname;
const mode = process.env.NODE_ENV ?? "development";
const projectId = process.env.MOON_PROJECT_ID;

const apps =
	projectId && APP_PATHS[projectId]
		? [APP_PATHS[projectId]]
		: Object.values(APP_PATHS);

const source = path.join(repo, `.env.${mode}`);

if (!fs.existsSync(source)) {
	console.warn(`.env.${mode} is required to run the app`);
	process.exit(0);
}

for (const app of apps) {
	const target = path.join(repo, app, `.env.${mode}`);
	const appName = path.basename(app);

	if (fs.existsSync(target)) {
		console.info(`.env.${mode} for the ${appName} app is already defined`);
	}

	if (!fs.existsSync(target) && appName === "marketing") {
		const rawEnv = fs.readFileSync(source, "utf8");
		const filteredEnv = rawEnv
			.split("\n")
			.filter((line) => !/^CONVEX_/u.test(line.trim()))
			.join("\n");
		fs.writeFileSync(target, filteredEnv, "utf8");
	}

	if (!fs.existsSync(target) && appName === "dashboard") {
		const relative = path.relative(path.dirname(target), source);
		fs.symlinkSync(relative, target);
	}

	console.info(`Created .env.${mode} for the ${appName} app`);
}
