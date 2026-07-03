import fs from "node:fs/promises";
import path from "node:path";
import { getAthenaPaths, ensureAthenaDirs, type AthenaPaths } from "./paths.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogMeta {
  [key: string]: unknown;
}

export interface ToolCallLogEntry {
  type: "tool_call";
  timestamp: string;
  tool: string;
  client: string;
  durationMs: number;
  success: boolean;
  input?: unknown; // may be redacted
  outputPreview?: string; // truncated success
  error?: string; // message + stack summary
}

interface StatsData {
  startedAt: string;
  lastUpdated: string;
  totalCalls: number;
  totalErrors: number;
  toolStats: Record<
    string,
    {
      calls: number;
      errors: number;
      totalDurationMs: number;
    }
  >;
  recentErrors: Array<{
    timestamp: string;
    tool: string;
    message: string;
  }>;
}

const MAX_RECENT_ERRORS = 25;
const MAX_PREVIEW = 2000;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    // Redact obvious secrets
    return value
      .replace(/([A-Za-z0-9_\-]{20,})/g, (m) => (m.length > 30 ? "[REDACTED]" : m))
      .replace(/(api[_-]?key|apikey|token|secret|password)\s*[:=]\s*['"]?[^'"\s]+/gi, "$1=[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (["apikey", "api_key", "api-key", "token", "secret", "password", "auth"].some((s) => lower.includes(s))) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

function truncate(str: string, max = MAX_PREVIEW): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…[truncated]";
}

function formatLogLine(level: LogLevel, message: string, meta?: LogMeta): string {
  const ts = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length
    ? " " + JSON.stringify(redact(meta))
    : "";
  return `${ts} [${level.toUpperCase()}] ${message}${metaStr}\n`;
}

let loggerInstance: Logger | null = null;

export class Logger {
  private paths!: AthenaPaths;
  private stats: StatsData;
  private initialized = false;
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor() {
    this.stats = {
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      totalCalls: 0,
      totalErrors: 0,
      toolStats: {},
      recentErrors: [],
    };
  }

  static getInstance(): Logger {
    if (!loggerInstance) loggerInstance = new Logger();
    return loggerInstance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.paths = await ensureAthenaDirs();
    await this.loadStats();
    this.initialized = true;
    await this.info("Logger initialized", { logsDir: this.paths.logsDir });
  }

  private async loadStats(): Promise<void> {
    try {
      const raw = await fs.readFile(this.paths.statsFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<StatsData>;
      if (parsed) {
        this.stats = {
          startedAt: parsed.startedAt || this.stats.startedAt,
          lastUpdated: parsed.lastUpdated || this.stats.lastUpdated,
          totalCalls: parsed.totalCalls ?? 0,
          totalErrors: parsed.totalErrors ?? 0,
          toolStats: parsed.toolStats ?? {},
          recentErrors: parsed.recentErrors ?? [],
        };
      }
    } catch {
      // no stats yet, use defaults
    }
  }

  private async persistStats(): Promise<void> {
    this.stats.lastUpdated = new Date().toISOString();
    const tmp = this.paths.statsFile + ".tmp";
    const data = JSON.stringify(this.stats, null, 2);
    try {
      await fs.writeFile(tmp, data, "utf8");
      await fs.rename(tmp, this.paths.statsFile);
    } catch (e) {
      // fallback direct write
      try { await fs.writeFile(this.paths.statsFile, data, "utf8"); } catch {}
    }
  }

  private async appendToFile(filePath: string, content: string): Promise<void> {
    // queue writes to avoid interleaving
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await fs.appendFile(filePath, content, "utf8");
      } catch (err) {
        // last resort to stderr
        process.stderr.write(`[logger] failed to append ${filePath}: ${String(err)}\n`);
      }
    });
    await this.writeQueue;
  }

  async log(level: LogLevel, message: string, meta?: LogMeta): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    const line = formatLogLine(level, message, meta);
    // always to stderr for MCP visibility (hosts usually capture stderr)
    process.stderr.write(line);

    // to file
    try {
      await this.appendToFile(this.paths.mainLog, line);
    } catch {
      // already handled inside append
    }

    if (level === "error") {
      // also ensure recent errors if not tool specific
    }
  }

  async debug(message: string, meta?: LogMeta): Promise<void> {
    return this.log("debug", message, meta);
  }

  async info(message: string, meta?: LogMeta): Promise<void> {
    return this.log("info", message, meta);
  }

  async warn(message: string, meta?: LogMeta): Promise<void> {
    return this.log("warn", message, meta);
  }

  async error(message: string, meta?: LogMeta): Promise<void> {
    return this.log("error", message, meta);
  }

  /** Log a complete tool call (success or failure). Also updates stats. */
  async logToolCall(entry: Omit<ToolCallLogEntry, "timestamp" | "type">): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    const fullEntry: ToolCallLogEntry = {
      type: "tool_call",
      timestamp: new Date().toISOString(),
      ...entry,
      input: redact(entry.input),
    };

    // Update stats
    const tool = entry.tool;
    if (!this.stats.toolStats[tool]) {
      this.stats.toolStats[tool] = { calls: 0, errors: 0, totalDurationMs: 0 };
    }
    const tstat = this.stats.toolStats[tool];
    tstat.calls += 1;
    tstat.totalDurationMs += entry.durationMs;
    this.stats.totalCalls += 1;
    if (!entry.success) {
      tstat.errors += 1;
      this.stats.totalErrors += 1;
      const errMsg = entry.error ? truncate(String(entry.error), 500) : "unknown";
      this.stats.recentErrors.unshift({
        timestamp: fullEntry.timestamp,
        tool,
        message: errMsg,
      });
      if (this.stats.recentErrors.length > MAX_RECENT_ERRORS) {
        this.stats.recentErrors.length = MAX_RECENT_ERRORS;
      }
    }

    // persist stats (fire and forget-ish but awaited in queue)
    await this.persistStats();

    // Write structured line to jsonl (never redact tool name/client)
    const jsonLine = JSON.stringify(fullEntry) + "\n";
    await this.appendToFile(this.paths.toolCallsLog, jsonLine);

    // Human friendly also to main log
    const status = entry.success ? "OK" : "ERR";
    const preview = entry.error
      ? `error=${truncate(String(entry.error), 300)}`
      : entry.outputPreview ? `preview=${truncate(entry.outputPreview, 180)}` : "";
    await this.log("info", `TOOL ${status} ${tool} (${entry.client}) ${entry.durationMs}ms ${preview}`);
  }

  getStatsSnapshot(): StatsData {
    return { ...this.stats, toolStats: { ...this.stats.toolStats }, recentErrors: [...this.stats.recentErrors] };
  }

  getPaths(): AthenaPaths {
    return this.paths;
  }
}

export const logger = Logger.getInstance();
