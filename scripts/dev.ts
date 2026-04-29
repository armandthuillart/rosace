import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { createInterface } from "node:readline";

import { Command } from "commander";

type ServiceName = "astro" | "svelte" | "convex";

type Service = {
  name: ServiceName;
  command: readonly [string, ...string[]];
  cwd?: string;
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

function logLine(kind: "info" | "success", service: ServiceName, message: string) {
  const section: Section = service === "convex" ? "convex" : "apps";
  const symbol = kind === "success" ? "✓" : "•";
  const serviceTag =
    kind === "success" ? `[${service}]` : paint(SERVICE_COLORS[service], `[${service}]`);
  const line = `${symbol} ${serviceTag} ${timestamp()} ${message}`;

  const outputLine = kind === "success" ? paint(SUCCESS_GREEN, line) : line;

  if (section === "apps") {
    pushAppLine(service, outputLine);
    return;
  }
  pushLine(section, outputLine);
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

function toFriendlyMessage(service: ServiceName, rawLine: string) {
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
  return null;
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

  const onLine = (line: string) => {
    const cleanedLine = stripAnsi(line).trim();

    if (service.name === "convex") {
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

    const event = toFriendlyMessage(service.name, line);
    if (!event) return;

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
    stdout.on("line", onLine);
  }

  if (child.stderr) {
    const stderr = createInterface({ input: child.stderr });
    stderr.on("line", onLine);
  }

  child.once("exit", () => {
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
