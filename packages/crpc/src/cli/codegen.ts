import { spawn } from "node:child_process";
import { existsSync, readFileSync, watch as fsWatch } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATES = resolve(__dirname, "generator");

const REGEN_DEBOUNCE_MS = 100;
const CRPC_CODEGEN_ENV = { CRPC_CODEGEN: "1" } as const;

const GENERATED_STEMS = new Set([
  "api.d.ts",
  "api.js",
  "dataModel.d.ts",
  "server.d.ts",
  "server.js",
]);

function readTemplate(name: string): string {
  return readFileSync(resolve(TEMPLATES, name), "utf-8");
}

function findWorkspaceRoot(cwd: string): string {
  let currentDir = resolve(cwd);

  for (;;) {
    if (existsSync(join(currentDir, ".git"))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return cwd;
    }
    currentDir = parentDir;
  }
}

function getConvexCwd(cwd = process.cwd()): string {
  return resolve(findWorkspaceRoot(cwd), "packages", "convex");
}

async function runConvex(
  args: string[],
  cwd = getConvexCwd(),
  env?: Record<string, string>,
): Promise<number> {
  return new Promise((ok, err) => {
    const child = spawn("vp", ["exec", "convex", ...args], {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: "inherit",
    });

    child.on("error", (e) => {
      err(e);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        ok(0);
      } else {
        err(new Error(`convex ${args.join(" ")} failed`));
      }
    });
  });
}

const CRPC_DIR = "src/_crpc";

async function generateFiles(cwd: string): Promise<void> {
  const out = resolve(cwd, CRPC_DIR);
  const legacyOut = resolve(cwd, "src/crpc");
  await mkdir(out, { recursive: true });

  const writes = [
    ["adapter.ts", readTemplate("adapter.ts")],
    ["auth.ts", readTemplate("auth.ts")],
    ["triggers.ts", readTemplate("triggers.ts")],
    ["http.ts", readTemplate("http.ts")],
    ["types.ts", readTemplate("types.ts")],
    ["index.ts", readTemplate("index.ts")],
  ] as const;

  await Promise.all(writes.map(([name, content]) => writeFile(resolve(out, name), content)));
  await Promise.all(
    [
      "create-adapter.ts",
      "create_adapter.ts",
      "define_auth.ts",
      "define_triggers.ts",
      "http_middleware.ts",
      "shared_types.ts",
      "_adapter.ts",
      "_auth.ts",
      "_triggers.ts",
      "_http.ts",
      "_types.ts",
      "define-auth.ts",
      "define-triggers.ts",
      "http-middleware.ts",
      "shared-types.ts",
    ].map((name) => rm(resolve(out, name), { force: true })),
  );
  await rm(resolve(cwd, "src/generated"), { force: true, recursive: true });
  await rm(legacyOut, { force: true, recursive: true });
}

function createConvexWatcher(cwd: string) {
  const targetDir = resolve(cwd, "src/_generated");

  let timer: ReturnType<typeof setTimeout> | undefined;
  let taskQueue = Promise.resolve();

  const scheduleGeneration = () => {
    taskQueue = taskQueue.then(() => generateFiles(cwd));
  };

  const fsListener = (_: string, filename: string | Buffer | null) => {
    if (!filename) {
      return;
    }

    const stem = filename.toString().replaceAll("\\", "/").split("/").pop();

    if (!(stem && GENERATED_STEMS.has(stem))) {
      return;
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(scheduleGeneration, REGEN_DEBOUNCE_MS);
  };

  const fsWatcher = fsWatch(targetDir, { recursive: true }, fsListener);

  return {
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      scheduleGeneration();
      await taskQueue;
    },

    stop() {
      if (timer) {
        clearTimeout(timer);
      }

      fsWatcher.close();
    },
  };
}

async function runCodegen(cwd: string, prod: boolean): Promise<void> {
  await generateFiles(cwd);

  const watcher = createConvexWatcher(cwd);
  const args = prod ? ["--prod"] : [];

  await runConvex(["codegen", ...args], cwd, CRPC_CODEGEN_ENV)
    .catch(async () => {
      await generateFiles(cwd);
      await runConvex(["codegen", ...args], cwd, CRPC_CODEGEN_ENV);
    })
    .then(() => watcher.flush())
    .finally(() => watcher.stop());
}

async function build() {
  await runCodegen(getConvexCwd(process.cwd()), false);
}

async function watch() {
  const cwd = getConvexCwd(process.cwd());
  await runCodegen(cwd, false);
  const watcher = createConvexWatcher(cwd);

  try {
    await runConvex(["dev"], cwd, CRPC_CODEGEN_ENV);
  } finally {
    watcher.stop();
  }
}

async function deploy(args: string[] = []): Promise<void> {
  const cwd = getConvexCwd(process.cwd());
  const prod = args.includes("--prod");

  await runCodegen(cwd, prod);

  await runConvex(["deploy", ...args], cwd, CRPC_CODEGEN_ENV);
}

export { build, deploy, runConvex, watch };
