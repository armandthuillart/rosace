import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { createInterface } from "node:readline";

import { Command } from "commander";

type ServiceName = "astro" | "svelte" | "convex";

type Service = {
  name: ServiceName;
  command: readonly [string, ...string[]];
  cwd?: string;
};
type ErrorIncidentState = {
  lines: string[];
  timer: ReturnType<typeof setTimeout> | null;
};
type LastErrorSignature = {
  signature: string;
  atMs: number;
};

type BunColorApi = { color: (input: string, outputFormat?: "ansi") => string | null };
const bunColor = (globalThis as { Bun?: BunColorApi }).Bun?.color;
const RESET = "\x1b[0m";
const SUCCESS_GREEN = "#22c55e";
type Section = "scripts" | "apps" | "convex";
const SECTION_TITLES: Record<Section, string> = {
  scripts: "1. Scripts.",
  apps: "2. Clients.",
  convex: "3. Servers.",
};
const SECTION_ORDER: Section[] = ["scripts", "apps", "convex"];
const sectionLines = new Map<Section, string[]>(SECTION_ORDER.map((section) => [section, []]));
const APP_SERVICE_ORDER: ServiceName[] = ["astro", "svelte"];
const appLines = new Map<ServiceName, string[]>(APP_SERVICE_ORDER.map((service) => [service, []]));
const MAX_LOGS_PER_BUCKET = 10;

const SERVICE_COLORS: Record<ServiceName, string> = {
  astro: "#6B7280",
  svelte: "#FE3F01",
  convex: "#8D2676",
};
const ERROR_INCIDENT_DEBOUNCE_MS = 250;
const ERROR_DUPLICATE_WINDOW_MS = 2000;
const WORKSPACE_ROOT = process.cwd();
const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".svelte"];
const errorStates = new Map<ServiceName, ErrorIncidentState>();
const lastErrorSignatures = new Map<ServiceName, LastErrorSignature>();
const suppressErrorIncidentsUntilMs = new Map<ServiceName, number>();

const SERVICES: readonly Service[] = [
  { name: "svelte", command: ["vp", "run", "dashboard#dev"] },
  { name: "astro", command: ["vp", "run", "marketing#dev"] },
  { name: "convex", command: ["vp", "exec", "convex", "dev"], cwd: "packages/convex" },
];

function paint(color: string, text: string) {
  const ansi = bunColor?.(color, "ansi");
  if (!ansi) return text;
  return `${ansi}${text}${RESET}`;
}

function timestamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function renderSections() {
  process.stdout.write("\x1b[2J\x1b[H");
  for (const section of SECTION_ORDER) {
    process.stdout.write(`${SECTION_TITLES[section]}\n\n`);
    if (section === "apps") {
      for (const [index, service] of APP_SERVICE_ORDER.entries()) {
        for (const line of appLines.get(service) ?? []) {
          process.stdout.write(`${line}\n`);
        }
        if (index < APP_SERVICE_ORDER.length - 1) {
          process.stdout.write("\n");
        }
      }
    } else {
      for (const line of sectionLines.get(section) ?? []) {
        process.stdout.write(`${line}\n`);
      }
    }
    process.stdout.write("\n");
  }
}

function pushLine(section: Section, line: string) {
  if (section === "apps") return;
  const lines = sectionLines.get(section);
  if (!lines) return;
  lines.push(line);
  if (lines.length > MAX_LOGS_PER_BUCKET) lines.splice(0, lines.length - MAX_LOGS_PER_BUCKET);
  renderSections();
}

function pushAppLine(service: ServiceName, line: string) {
  const lines = appLines.get(service);
  if (!lines) return;
  lines.push(line);
  if (lines.length > MAX_LOGS_PER_BUCKET) lines.splice(0, lines.length - MAX_LOGS_PER_BUCKET);
  renderSections();
}

function logGlobalInfo(message: string) {
  pushLine("scripts", `• ${timestamp()} ${message}`);
}

function logGlobalSuccess(message: string) {
  pushLine("scripts", paint(SUCCESS_GREEN, `✓ ${timestamp()} ${message}`));
}

function logLine(kind: "info" | "success" | "error", service: ServiceName, message: string) {
  const section: Section = service === "convex" ? "convex" : "apps";
  const symbol = kind === "success" ? "✓" : kind === "error" ? "✖" : "•";
  const serviceTag =
    kind === "info" ? paint(SERVICE_COLORS[service], `[${service}]`) : `[${service}]`;
  const line = `${symbol} ${serviceTag} ${timestamp()} ${message}`;

  const outputLine =
    kind === "success"
      ? paint(SUCCESS_GREEN, line)
      : kind === "error"
        ? `\x1b[1;31m${line}${RESET}`
        : line;

  if (section === "apps") {
    pushAppLine(service, outputLine);
    return;
  }
  pushLine(section, outputLine);
}

function logConvexHttpError(method: string, path: string, cause: string) {
  const line1 = `• [convex] ${timestamp()} ${method.toUpperCase()} / 500`;
  const line2 = `• [convex] ${timestamp()} ↳ route ${path} (${cause})`;
  pushLine("convex", `\x1b[1;31m${line1}${RESET}`);
  pushLine("convex", `\x1b[1;31m${line2}${RESET}`);
}

function serviceByName(name: ServiceName) {
  return SERVICES.find((service) => service.name === name)!;
}

function getPrimaryLanIp() {
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}

function buildNetworkUrlFromLocal(localMessage: string) {
  const localUrl = localMessage.match(/https?:\/\/\S+/i)?.[0];
  if (!localUrl) return null;
  const port = localUrl.match(/:(\d+)(?:\/|$)/)?.[1];
  if (!port) return null;
  const ip = getPrimaryLanIp();
  if (!ip) return null;
  return `http://${ip}:${port}/`;
}

function formatDuration(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatPathForDisplay(path: string) {
  if (path.startsWith(`${WORKSPACE_ROOT}/`)) {
    return path.slice(WORKSPACE_ROOT.length + 1);
  }
  return path;
}

function stripAnsi(input: string) {
  let out = "";
  let i = 0;
  while (i < input.length) {
    if (input[i] === "\u001b" && input[i + 1] === "[") {
      i += 2;
      while (i < input.length) {
        const code = input.charCodeAt(i);
        if (code >= 0x40 && code <= 0x7e) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += input[i];
    i += 1;
  }
  return out;
}

function toFriendlyMessage(service: ServiceName, rawLine: string, stream: "stdout" | "stderr") {
  const text = stripAnsi(rawLine).trim();
  if (!text) return null;

  const localUrl = text.match(/(?:➜\s+)?Local:?\s+(https?:\/\/\S+)|┃\s*Local\s+(https?:\/\/\S+)/i);
  if (localUrl) {
    const url = localUrl[1] ?? localUrl[2];
    return { kind: "info" as const, message: `- Local: ${url}` };
  }

  const networkUrl = text.match(
    /(?:➜\s+)?Network:?\s+(https?:\/\/\S+)|┃\s*Network\s+(https?:\/\/\S+)/i,
  );
  if (networkUrl) {
    const url = networkUrl[1] ?? networkUrl[2];
    return { kind: "info" as const, message: `- Network: ${url}` };
  }

  const genericLocal = text.match(/local[^\n]*?(https?:\/\/\S+)/i);
  if (genericLocal) {
    return { kind: "info" as const, message: `- Local: ${genericLocal[1]}` };
  }

  const genericNetwork = text.match(/network[^\n]*?(https?:\/\/\S+)/i);
  if (genericNetwork) {
    return { kind: "info" as const, message: `- Network: ${genericNetwork[1]}` };
  }

  const anyUrl = text.match(/https?:\/\/\S+/i);
  if (anyUrl) {
    const url = anyUrl[0];
    const isLocalhost = /https?:\/\/(localhost|127\.0\.0\.1)/i.test(url);
    if (isLocalhost) {
      return { kind: "info" as const, message: `- Local: ${url}` };
    }
    return { kind: "info" as const, message: `- Network: ${url}` };
  }

  if (service === "convex" && /Preparing Convex functions/i.test(text)) {
    return { kind: "info" as const, message: "Preparing functions..." };
  }
  if (service === "convex" && /Convex functions ready!/i.test(text)) {
    return { kind: "success" as const, message: "Functions ready." };
  }

  const isNoise =
    /^\[vite\]\s+connected\.?$/i.test(text) ||
    /^VITE\+\s+v[\d.]+$/i.test(text) ||
    /^➜\s+Network:/i.test(text) ||
    /^\d{1,2}:\d{2}:\d{2}\s+\[(types|content)\]/i.test(text) ||
    /^.+watching for file changes/i.test(text) ||
    /cache disabled$/i.test(text) ||
    /^\$\s/.test(text);

  if (isNoise) return null;
  if (stream === "stderr") return { kind: "error" as const, message: text };
  return null;
}

function isOverlayNoiseLine(line: string) {
  return (
    /^Click outside, press Esc key, or fix the code to dismiss\.?$/i.test(line) ||
    /^You can also disable this overlay by setting .*vite\.config\./i.test(line)
  );
}

function normalizeCause(lines: string[]) {
  const enrichWorkspaceSpecifiers = (input: string) =>
    input.replace(/\/[A-Za-z0-9._\-+/()]+/g, (specifier) => {
      // Only enrich workspace-relative absolute paths (e.g. /packages/helpers/src/env).
      if (!specifier.startsWith("/")) return specifier;
      if (/\.[a-z0-9]+$/i.test(specifier)) return specifier;

      const candidateBase = `${WORKSPACE_ROOT}${specifier}`;
      if (existsSync(candidateBase)) return specifier;

      for (const extension of RESOLVABLE_EXTENSIONS) {
        if (existsSync(`${candidateBase}${extension}`)) {
          return `${specifier}${extension}`;
        }
      }

      for (const extension of RESOLVABLE_EXTENSIONS) {
        if (existsSync(`${candidateBase}/index${extension}`)) {
          return `${specifier}/index${extension}`;
        }
      }

      return specifier;
    });

  const candidates = lines
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith("at ") &&
        !isOverlayNoiseLine(line) &&
        !/^Error\s*\[[A-Z0-9_]+\]:\s*/.test(line),
    );

  const preferred =
    candidates.find((line) => /Cannot find module|Module not found/i.test(line)) ??
    candidates.find((line) =>
      /(TypeError|ReferenceError|SyntaxError|RangeError|ERR_[A-Z0-9_]+)/.test(line),
    ) ??
    candidates[0];

  if (preferred) {
    const noPrefix = preferred.replace(
      /^\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?\s+\[[^\]]+\]\s+\((?:ssr|client)\)\s*/i,
      "",
    );
    return enrichWorkspaceSpecifiers(noPrefix.replaceAll(WORKSPACE_ROOT, ""));
  }

  const fallback = lines.find((line) => !line.trim().startsWith("at "));
  if (fallback) {
    const noPrefix = fallback
      .trim()
      .replace(/^\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?\s+\[[^\]]+\]\s+\((?:ssr|client)\)\s*/i, "");
    return enrichWorkspaceSpecifiers(noPrefix.replaceAll(WORKSPACE_ROOT, ""));
  }

  return "Unknown runtime error";
}

function getOriginFromLines(lines: string[]) {
  for (const line of lines) {
    const match = line.match(/\bat\s+(?:.+?\s+\()?((?:\/|[A-Za-z]:\\)[^():]+):(\d+):(\d+)\)?$/);
    if (!match) continue;
    const file = match[1];
    if (file.startsWith("node:")) continue;
    if (/\/node_modules\//.test(file)) continue;
    return `${formatPathForDisplay(file)}:${match[2]}:${match[3]}`;
  }

  for (const line of lines) {
    const importedFromMatch = line.match(/\bimported from ((?:\/|[A-Za-z]:\\)\S+)/i);
    if (importedFromMatch) {
      return formatPathForDisplay(importedFromMatch[1].replace(/[)\],.;]+$/, ""));
    }
  }

  for (const line of lines) {
    const ssrModuleMatch = line.match(/\bSSR module (\S+)/i);
    if (ssrModuleMatch) {
      const rawPath = ssrModuleMatch[1].replace(/[)\],.;]+$/, "");
      const normalizedPath = rawPath.startsWith("/")
        ? rawPath.startsWith(`${WORKSPACE_ROOT}/`)
          ? rawPath
          : `${WORKSPACE_ROOT}${rawPath}`
        : rawPath;
      return formatPathForDisplay(normalizedPath);
    }
  }

  return null;
}

function flushErrorIncident(service: ServiceName) {
  const state = errorStates.get(service);
  if (!state || state.lines.length === 0) return;

  const lines = state.lines.splice(0, state.lines.length);
  state.timer = null;

  const cause = normalizeCause(lines);
  const origin = getOriginFromLines(lines) ?? "unknown";
  const signature = `${cause}::${origin}`;
  const now = Date.now();

  const last = lastErrorSignatures.get(service);
  if (last && last.signature === signature && now - last.atMs < ERROR_DUPLICATE_WINDOW_MS) {
    return;
  }
  lastErrorSignatures.set(service, { signature, atMs: now });

  logLine("error", service, `- ${cause}`);
}

function queueErrorLine(service: ServiceName, line: string) {
  const suppressedUntil = suppressErrorIncidentsUntilMs.get(service) ?? 0;
  if (Date.now() < suppressedUntil) return;

  const text = line.trim();
  if (!text || isOverlayNoiseLine(text)) return;

  const current =
    errorStates.get(service) ??
    (() => {
      const initial: ErrorIncidentState = { lines: [], timer: null };
      errorStates.set(service, initial);
      return initial;
    })();

  current.lines.push(text);
  if (current.timer) clearTimeout(current.timer);
  current.timer = setTimeout(() => {
    flushErrorIncident(service);
  }, ERROR_INCIDENT_DEBOUNCE_MS);
}

function startService(service: Service, children: Set<ReturnType<typeof spawn>>) {
  const startedAt = Date.now();
  let readyShown = false;
  let sawLocal = false;
  let sawNetwork = false;
  let sawReadySignal = false;
  let serviceReadyMs: number | null = null;
  let convexBootstrapped = false;

  if (service.name !== "convex") {
    logLine("info", service.name, "Starting the development server...");
  }

  const child = spawn(service.command[0], service.command.slice(1), {
    cwd: service.cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.add(child);

  const onLine = (line: string, stream: "stdout" | "stderr") => {
    const cleanedLine = stripAnsi(line).trim();

    if (service.name === "convex") {
      const convexHttpError = cleanedLine.match(
        /\[CONVEX H\((GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^)]+)\)\]\s+Uncaught Error:\s+(.+)$/i,
      );
      if (convexHttpError) {
        const [, method, path, cause] = convexHttpError;
        const current = errorStates.get(service.name);
        if (current?.timer) clearTimeout(current.timer);
        if (current) {
          current.lines.length = 0;
          current.timer = null;
        }
        suppressErrorIncidentsUntilMs.set(service.name, Date.now() + 750);
        logConvexHttpError(method, path, cause);
        return;
      }

      if (/Preparing Convex functions/i.test(cleanedLine)) {
        if (!convexBootstrapped) {
          logLine("info", service.name, "Preparing functions...");
        }
        return;
      }
      if (/Convex functions ready!/i.test(cleanedLine)) {
        if (!convexBootstrapped) {
          convexBootstrapped = true;
          const convexReadyMatch = cleanedLine.match(/Convex functions ready!\s*\(([\d.]+)s\)/i);
          if (convexReadyMatch) {
            const ms = Math.round(Number(convexReadyMatch[1]) * 1000);
            logLine("success", service.name, `Ready in ${formatDuration(ms)}.`);
          } else {
            logLine("success", service.name, `Ready in ${formatDuration(0)}.`);
          }
        }
        return;
      }
    }

    const readyMatch = cleanedLine.match(/ready in\s+(\d+)\s*ms/i);
    if (service.name !== "convex" && readyMatch) {
      sawReadySignal = true;
      serviceReadyMs = Number(readyMatch[1]);
    }

    const event = toFriendlyMessage(service.name, line, stream);
    if (!event) return;
    if (event.kind === "error") {
      queueErrorLine(service.name, event.message);
      return;
    }

    if (service.name !== "convex" && event.message.startsWith("- Local:")) sawLocal = true;
    if (service.name !== "convex" && event.message.startsWith("- Network:")) {
      if (sawNetwork) return;
      sawNetwork = true;
    }
    logLine(event.kind, service.name, event.message);

    if (service.name === "astro" && event.message.startsWith("- Local:") && !sawNetwork) {
      const fallbackNetworkUrl = buildNetworkUrlFromLocal(event.message);
      if (fallbackNetworkUrl) {
        sawNetwork = true;
        logLine("info", service.name, `- Network: ${fallbackNetworkUrl}`);
      }
    }

    const canEmitReady =
      service.name !== "convex" &&
      !readyShown &&
      ((sawReadySignal && sawLocal) || (sawLocal && sawNetwork));

    if (canEmitReady) {
      readyShown = true;
      const readyMs = serviceReadyMs ?? Date.now() - startedAt;
      logLine("success", service.name, `Ready in ${formatDuration(readyMs)}.`);
    }
  };

  if (child.stdout) {
    const stdout = createInterface({ input: child.stdout });
    stdout.on("line", (line) => onLine(line, "stdout"));
  }

  if (child.stderr) {
    const stderr = createInterface({ input: child.stderr });
    stderr.on("line", (line) => onLine(line, "stderr"));
  }

  child.once("exit", (code) => {
    flushErrorIncident(service.name);
    if ((code ?? 0) !== 0) {
      logLine("error", service.name, `Process exited with code ${code ?? 0}.`);
    }
    children.delete(child);
  });
}

async function waitForExit(child: ReturnType<typeof spawn>) {
  return await new Promise<number>((resolve) => {
    child.once("exit", (code) => resolve(code ?? 0));
  });
}

async function runPrepare() {
  logGlobalInfo("Preparing .env.* files...");
  const child = spawn("vp", ["run", "prepare"], { stdio: ["ignore", "ignore", "ignore"] });
  await waitForExit(child);
  logGlobalSuccess(".env.* files were prepared successfully.");
}

function resolveServices(opts: { astro: boolean; svelte: boolean; convex: boolean }) {
  const selected: ServiceName[] = [];
  if (opts.astro) selected.push("astro");
  if (opts.svelte) selected.push("svelte");
  if (opts.convex) selected.push("convex");

  const base = selected.length > 0 ? selected : (["astro", "svelte", "convex"] as ServiceName[]);

  const withDependencies = new Set<ServiceName>(base);
  if (withDependencies.has("svelte")) withDependencies.add("convex");

  return [...withDependencies].map((name) => serviceByName(name));
}

async function main() {
  const program = new Command();
  program
    .option("--skip-prepare", "Skip vp run prepare")
    .option("--astro", "Start astro")
    .option("--svelte", "Start svelte")
    .option("--convex", "Start convex")
    .allowExcessArguments(false)
    .parse(process.argv);

  const opts = program.opts<{
    skipPrepare: boolean;
    astro: boolean;
    svelte: boolean;
    convex: boolean;
  }>();

  if (!opts.skipPrepare) await runPrepare();

  const services = resolveServices(opts);
  const children = new Set<ReturnType<typeof spawn>>();

  process.on("SIGINT", () => {
    for (const child of children) child.kill("SIGTERM");
    process.exit(0);
  });

  for (const service of services) startService(service, children);
}

void main();
