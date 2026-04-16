import { spawn } from "node:child_process";
import { watch as fsWatch, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATES = resolve(__dirname, "generated");

const REGEN_DEBOUNCE_MS = 100;

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

async function runConvex(
  args: string[],
  cwd = process.cwd(),
  env?: Record<string, string>,
): Promise<number> {
  return new Promise((ok, err) => {
    const child = spawn("bunx", ["convex", ...args], {
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

const CRPC_DIR = "crpc";

async function generateFiles(cwd: string): Promise<void> {
  const out = resolve(cwd, "src", CRPC_DIR);
  await mkdir(out, { recursive: true });

  const writes = [
    ["auth.ts", readTemplate("auth.ts")],
    ["http.ts", readTemplate("http.ts")],
    ["types.ts", readTemplate("types.ts")],
  ] as const;

  await Promise.all(writes.map(([name, content]) => writeFile(resolve(out, name), content)));
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

  await runConvex(["codegen", ...args], cwd, { CRPC_CODEGEN: "1" })
    .catch(async () => {
      await generateFiles(cwd);
      await runConvex(["codegen", ...args], cwd, { CRPC_CODEGEN: "1" });
    })
    .then(() => watcher.flush())
    .finally(() => watcher.stop());
}

async function build() {
  await runCodegen(process.cwd(), false);
}

async function watch() {
  const cwd = process.cwd();
  await runCodegen(cwd, false);
  const watcher = createConvexWatcher(cwd);

  try {
    await runConvex(["dev"], cwd, { CRPC_CODEGEN: "1" });
  } finally {
    watcher.stop();
  }
}

async function deploy(args: string[] = []): Promise<void> {
  const cwd = process.cwd();
  const prod = args.includes("--prod");

  await runCodegen(cwd, prod);

  await runConvex(["deploy", ...args], cwd, {
    CRPC_CODEGEN: "1",
  });
}

export { build, deploy, runConvex, watch };
