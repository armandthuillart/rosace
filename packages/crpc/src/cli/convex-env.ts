import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface ConvexEnvOpts {
  prod?: boolean;
}

const getConvexCommand = () => (process.platform === "win32" ? "vp.cmd" : "vp");

async function runConvexInherit(args: string[], cwd: string = process.cwd()): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(getConvexCommand(), ["exec", "convex", ...args], {
      cwd,
      stdio: "inherit",
    });

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`convex ${args.join(" ")} failed with exit code ${code ?? -1}`));
    });
  });
}

export async function listConvexEnvVars(
  options: ConvexEnvOpts = {},
  cwd: string = process.cwd(),
): Promise<Map<string, string>> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      getConvexCommand(),
      ["exec", "convex", "env", "list", ...(options.prod ? ["--prod"] : [])],
      { cwd, stdio: ["ignore", "pipe", "ignore"] },
    );

    let stdout = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.on("error", rejectPromise);

    child.on("exit", (code) => {
      if (code === 0) {
        const envMap = new Map<string, string>();

        for (const line of stdout.split(/\r?\n/u)) {
          if (line) {
            const sep = line.indexOf("=");

            if (sep !== -1) {
              envMap.set(line.slice(0, sep), line.slice(sep + 1));
            }
          }
        }

        resolvePromise(envMap);
        return;
      }

      rejectPromise(new Error(`convex env list failed with exit code ${code ?? -1}`));
    });
  });
}

export async function setConvexEnvVar(
  name: string,
  value: string,
  options: ConvexEnvOpts = {},
  cwd: string = process.cwd(),
): Promise<void> {
  await runConvexInherit(["env", "set", name, value, ...(options.prod ? ["--prod"] : [])], cwd);
}

export async function setConvexEnvVarFromFile(
  name: string,
  value: string,
  options: ConvexEnvOpts = {},
  cwd: string = process.cwd(),
): Promise<void> {
  const file = join(tmpdir(), `crpc-convex-env-${randomBytes(8).toString("hex")}.txt`);
  try {
    writeFileSync(file, value, "utf8");
    await runConvexInherit(
      ["env", "set", name, "--from-file", file, ...(options.prod ? ["--prod"] : [])],
      cwd,
    );
  } finally {
    try {
      unlinkSync(file);
    } catch {}
  }
}

export async function getConvexEnvVar(
  name: string,
  options: ConvexEnvOpts = {},
  cwd: string = process.cwd(),
): Promise<string | undefined> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      getConvexCommand(),
      ["exec", "convex", "env", "get", name, ...(options.prod ? ["--prod"] : [])],
      { cwd, stdio: ["ignore", "pipe", "ignore"] },
    );

    let stdout = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.on("error", rejectPromise);

    child.on("exit", (code) => {
      if (code === 0) {
        const v = stdout.trim();
        resolvePromise(v || undefined);
        return;
      }
      resolvePromise(undefined);
    });
  });
}
