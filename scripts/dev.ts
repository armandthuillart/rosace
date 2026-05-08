import { Command } from "commander";
import { color, file, spawn } from "bun";

type ServiceName = "astro" | "svelte" | "convex" | "ngrok";

type Service = {
  name: ServiceName;
  command: readonly [string, ...string[]];
  cwd?: string;
};

type ErrorIncident = {
  lines: string[];
  timer: ReturnType<typeof setTimeout> | null;
};

type LastErrorSignature = {
  signature: string;
  atMs: number;
};

type ServiceRuntimeState = {
  startedAt: number;
  isReadyShown: boolean;
  hasSeenUrl: boolean;
  hasSeenReadySignal: boolean;
  serviceReadyMs: number | null;
  isConvexBootstrapped: boolean;
  hasStartedTunnel: boolean;
  hasAnnouncedPublicUrl: boolean;
  resolveReady: (() => void) | null;
};

const bunColor = color;

const RESET = "\x1b[0m";
const SUCCESS_GREEN = "#16a34a";

const SERVICE_COLORS: Partial<Record<ServiceName, string>> = {
  astro: "#2563eb",
  svelte: "#ea580c",
  convex: "#7c3aed",
  ngrok: "#15803d",
};

const ERROR_INCIDENT_DEBOUNCE_MS = 250;
const ERROR_DUPLICATE_WINDOW_MS = 2000;

const WORKSPACE_ROOT = process.cwd();

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".svelte"];

const errorStates = new Map<ServiceName, ErrorIncident>();
const lastErrorSignatures = new Map<ServiceName, LastErrorSignature>();
const suppressErrorIncidentsUntilMs = new Map<ServiceName, number>();
type Subprocess = ReturnType<typeof spawn>;

const SERVICES: readonly Service[] = [
  {
    name: "svelte",
    command: ["vp", "run", "dashboard#dev"],
  },
  {
    name: "astro",
    command: ["vp", "run", "marketing#dev"],
  },
  {
    name: "convex",
    command: ["vp", "exec", "convex", "dev"],
    cwd: "packages/convex",
  },
];

function paint(color: string, text: string) {
  const ansi = bunColor?.(color, "ansi");
  if (!ansi) return text;
  return `${ansi}${text}${RESET}`;
}

function writeLine(line: string) {
  process.stdout.write(`${line}\n`);
}

async function readLines(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      onLine(buffer.slice(0, newlineIndex).replace(/\r$/, ""));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  if (buffer) onLine(buffer.replace(/\r$/, ""));
}

function timestamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function logGlobalInfo(message: string) {
  writeLine(`[${timestamp()}] · ${message}`);
}

function logGlobalSuccess(message: string) {
  writeLine(paint(SUCCESS_GREEN, `[${timestamp()}] ✓ ${message}`));
}

function logLine(kind: "info" | "success" | "error", service: ServiceName, message: string) {
  const symbol = kind === "success" ? "✓" : kind === "error" ? "✖" : "·";

  const isInfo = kind === "info";
  const serviceTag = isInfo ? paint(SERVICE_COLORS[service] ?? "", `[${service}]`) : `[${service}]`;

  const formattedLine = `[${timestamp()}] ${symbol} ${serviceTag} ${message}`;

  const outputLine =
    kind === "success"
      ? paint(SUCCESS_GREEN, formattedLine)
      : kind === "error"
        ? `\x1b[1;31m${formattedLine}${RESET}`
        : formattedLine;

  writeLine(outputLine);
}

function logConvexHttpError(method: string, path: string, cause: string) {
  const line1 = `[${timestamp()}] ✖ [convex] ${method.toUpperCase()} / 500`;
  const line2 = `[${timestamp()}] ✖ [convex] ↳ route ${path} (${cause})`;

  writeLine(`\x1b[1;31m${line1}${RESET}`);
  writeLine(`\x1b[1;31m${line2}${RESET}`);
}

function findServiceByName(name: ServiceName) {
  const service = SERVICES.find((s) => s.name === name);
  if (!service) throw new Error(`Service not found: ${name}`);
  return service;
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

function extractUrl(text: string): { url: string; type: "Local" | "Network" } | null {
  const patterns = [
    {
      regex: /(?:➜\s+)?Local:?\s+(https?:\/\/\S+)|┃\s*Local\s+(https?:\/\/\S+)/i,
      type: "Local" as const,
    },
    {
      regex: /(?:➜\s+)?Network:?\s+(https?:\/\/\S+)|┃\s*Network\s+(https?:\/\/\S+)/i,
      type: "Network" as const,
    },
    { regex: /local[^\n]*?(https?:\/\/\S+)/i, type: "Local" as const },
    { regex: /network[^\n]*?(https?:\/\/\S+)/i, type: "Network" as const },
  ];

  for (const { regex, type } of patterns) {
    const match = text.match(regex);
    if (match) return { url: match[1] ?? match[2], type };
  }

  const anyUrlMatch = text.match(/https?:\/\/\S+/i);
  if (anyUrlMatch) {
    const url = anyUrlMatch[0];
    const isLocalhost = /https?:\/\/(localhost|127\.0\.0\.1)/i.test(url);
    return { url, type: isLocalhost ? "Local" : "Network" };
  }

  return null;
}

function toFriendlyMessage(
  service: ServiceName,
  rawLine: string,
  stream: "stdout" | "stderr",
): {
  kind: "info" | "success" | "error";
  message: string;
  urlType?: "Local" | "Network";
  url?: string;
} | null {
  const text = stripAnsi(rawLine).trim();
  if (!text) return null;

  const url = extractUrl(text);
  if (url) {
    return {
      kind: "info" as const,
      message: `Running on ${url.url}.`,
      urlType: url.type,
      url: url.url,
    };
  }

  if (service === "convex" && /Preparing Convex functions/i.test(text)) {
    return { kind: "info" as const, message: "Preparing functions..." };
  }

  if (service === "convex" && /Convex functions ready!/i.test(text)) {
    return { kind: "success" as const, message: "Ready in 0ms." };
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

function startDashboardTunnel(port: string, dashboardUrl: string, children: Set<Subprocess>) {
  const child = spawn(["ngrok", "http", port, "--url", dashboardUrl, "--log=stdout"], {
    stdout: "ignore",
    stderr: "pipe",
  });

  children.add(child);

  let lastError = "";
  if (child.stderr) {
    void readLines(child.stderr, (line) => {
      const text = stripAnsi(line).trim();
      if (text) lastError = text;
    });
  }

  void (async () => {
    const code = await child.exited;
    if ((code ?? 0) !== 0) {
      const suffix = lastError ? `: ${lastError}` : ".";
      logLine("error", "ngrok", `Process exited with code ${code ?? 0}${suffix}`);
    }
    children.delete(child);
  })();
}

function createServiceRuntimeState(startedAt: number): ServiceRuntimeState {
  return {
    startedAt,
    isReadyShown: false,
    hasSeenUrl: false,
    hasSeenReadySignal: false,
    serviceReadyMs: null,
    isConvexBootstrapped: false,
    hasStartedTunnel: false,
    hasAnnouncedPublicUrl: false,
    resolveReady: null,
  };
}

function emitServiceReady(service: Service, state: ServiceRuntimeState) {
  if (state.isReadyShown || service.name === "convex") return;

  state.isReadyShown = true;
  const readyMs = state.serviceReadyMs ?? Date.now() - state.startedAt;
  logLine("success", service.name, `Ready in ${formatDuration(readyMs)}.`);
  state.resolveReady?.();
  state.resolveReady = null;
}

function handleServiceLine(
  service: Service,
  state: ServiceRuntimeState,
  children: Set<Subprocess>,
  line: string,
  stream: "stdout" | "stderr",
) {
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
      if (!state.isConvexBootstrapped) {
        logLine("info", service.name, "Preparing functions...");
      }
      return;
    }

    if (/Convex functions ready!/i.test(cleanedLine)) {
      if (!state.isConvexBootstrapped) {
        state.isConvexBootstrapped = true;

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
    state.hasSeenReadySignal = true;
    state.serviceReadyMs = Number(readyMatch[1]);
  }

  const event = toFriendlyMessage(service.name, line, stream);
  if (!event) return;

  if (event.kind === "error") {
    queueErrorLine(service.name, event.message);
    return;
  }

  if (service.name === "astro" && event.urlType === "Network") {
    return;
  }

  if (service.name === "svelte" && event.urlType === "Local") {
    state.hasSeenUrl = true;
    state.hasSeenReadySignal = true;
    state.serviceReadyMs = Date.now() - state.startedAt;

    if (!state.hasStartedTunnel) {
      state.hasStartedTunnel = true;
      const dashboardUrl = process.env.DASHBOARD_URL;
      if (dashboardUrl && !state.hasAnnouncedPublicUrl) {
        state.hasAnnouncedPublicUrl = true;
        const port = new URL(event.url ?? "http://localhost:5173").port || "80";
        startDashboardTunnel(port, dashboardUrl, children);
        logLine("info", service.name, `Running on ${dashboardUrl}.`);
      }
    }

    emitServiceReady(service, state);
    return;
  }

  if (event.urlType === "Local") {
    state.hasSeenUrl = true;
  }

  logLine(event.kind, service.name, event.message);

  const canEmitReady =
    service.name !== "convex" &&
    !state.isReadyShown &&
    state.hasSeenReadySignal &&
    state.hasSeenUrl;

  if (canEmitReady) emitServiceReady(service, state);
}

async function pathExists(path: string) {
  return await file(path).exists();
}

async function enrichWorkspaceSpecifiers(input: string): Promise<string> {
  let output = input;
  const specifiers = Array.from(input.matchAll(/\/[A-Za-z0-9._\-+/()]+/g), (match) => match[0]);

  for (const specifier of specifiers) {
    if (!specifier.startsWith("/")) continue;
    if (/\.[a-z0-9]+$/i.test(specifier)) continue;

    const candidateBase = `${WORKSPACE_ROOT}${specifier}`;
    if (await pathExists(candidateBase)) continue;

    let replacement = specifier;

    for (const extension of RESOLVABLE_EXTENSIONS) {
      if (await pathExists(`${candidateBase}${extension}`)) {
        replacement = `${specifier}${extension}`;
        break;
      }
    }

    if (replacement === specifier) {
      for (const extension of RESOLVABLE_EXTENSIONS) {
        if (await pathExists(`${candidateBase}/index${extension}`)) {
          replacement = `${specifier}/index${extension}`;
          break;
        }
      }
    }

    if (replacement !== specifier) {
      output = output.replaceAll(specifier, replacement);
    }
  }

  return output;
}

function stripLinePrefix(line: string): string {
  return line
    .replace(/^\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?\s+\[[^\]]+\]\s+\((?:ssr|client)\)\s*/i, "")
    .replaceAll(WORKSPACE_ROOT, "");
}

async function normalizeCause(lines: string[]) {
  const candidates = lines
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("at ") &&
        !isOverlayNoiseLine(l) &&
        !/^Error\s*\[[A-Z0-9_]+\]:\s*/.test(l),
    );

  const preferred =
    candidates.find((l) => /Cannot find module|Module not found/i.test(l)) ??
    candidates.find((l) =>
      /(TypeError|ReferenceError|SyntaxError|RangeError|ERR_[A-Z0-9_]+)/.test(l),
    ) ??
    candidates[0];

  if (preferred) {
    return await enrichWorkspaceSpecifiers(stripLinePrefix(preferred));
  }

  const fallback = lines.find((l) => !l.trim().startsWith("at "));
  if (fallback) {
    return await enrichWorkspaceSpecifiers(stripLinePrefix(fallback.trim()));
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

async function flushErrorIncident(service: ServiceName) {
  const state = errorStates.get(service);
  if (!state || state.lines.length === 0) return;

  const lines = state.lines.splice(0, state.lines.length);
  state.timer = null;

  const cause = await normalizeCause(lines);
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
      const initial: ErrorIncident = { lines: [], timer: null };
      errorStates.set(service, initial);
      return initial;
    })();

  current.lines.push(text);

  if (current.timer) clearTimeout(current.timer);

  current.timer = setTimeout(() => {
    void flushErrorIncident(service);
  }, ERROR_INCIDENT_DEBOUNCE_MS);
}

function startService(service: Service, children: Set<Subprocess>) {
  const state = createServiceRuntimeState(Date.now());
  const ready = new Promise<void>((resolve) => {
    state.resolveReady = resolve;
  });

  if (service.name !== "convex") {
    logLine("info", service.name, "Starting the development server...");
  }

  const child = spawn([...service.command], {
    cwd: service.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  children.add(child);

  const onLine = (line: string, stream: "stdout" | "stderr") => {
    handleServiceLine(service, state, children, line, stream);
  };

  if (child.stdout) {
    void readLines(child.stdout, (line) => onLine(line, "stdout"));
  }

  if (child.stderr) {
    void readLines(child.stderr, (line) => onLine(line, "stderr"));
  }

  void (async () => {
    const code = await child.exited;
    await flushErrorIncident(service.name);
    if ((code ?? 0) !== 0) {
      logLine("error", service.name, `Process exited with code ${code ?? 0}.`);
    }
    children.delete(child);
    state.resolveReady?.();
    state.resolveReady = null;
  })();

  return ready;
}

async function waitForExit(child: Subprocess) {
  return await child.exited;
}

async function runPrepare() {
  logGlobalInfo("Preparing .env.* files...");
  const child = spawn(["vp", "run", "prepare"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await waitForExit(child);
  logGlobalSuccess(".env.* files were prepared successfully.");
}

function resolveServices(opts: { astro: boolean; svelte: boolean; convex: boolean }) {
  const selected = new Set<ServiceName>();

  if (opts.convex) selected.add("convex");
  if (opts.astro) selected.add("astro");
  if (opts.svelte) {
    selected.add("svelte");
    selected.add("convex");
  }

  const order: ServiceName[] = ["convex", "astro", "svelte"];
  const base = selected.size > 0 ? order.filter((name) => selected.has(name)) : order;

  return base.map((name) => findServiceByName(name));
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
  const children = new Set<Subprocess>();

  process.on("SIGINT", () => {
    for (const child of children) child.kill("SIGTERM");
    process.exit(0);
  });

  const astro = services.find((service) => service.name === "astro");
  if (astro) {
    await startService(astro, children);
  }

  for (const service of services) {
    if (service.name === "astro") continue;
    void startService(service, children);
  }
}

void main();
