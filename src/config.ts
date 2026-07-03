import fs from "node:fs";
import * as YAML from "yaml";
import { getAthenaPaths } from "./paths.js";

function parseBooleanFlag(value?: string): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function parseClientList(value?: string): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export interface FileConfig {
  athena_base_url?: string;
  athena_api_key?: string;
  athena_default_client?: string;
  athena_available_clients?: string[] | string;
  read_only?: boolean;
  health_port?: number;
  athena_admin_experimental_enabled?: boolean;
  // allow nested
  athena?: Partial<FileConfig>;
}

function loadFileConfig(): FileConfig {
  const paths = getAthenaPaths();
  try {
    if (!fs.existsSync(paths.configFile)) return {};
    const raw = fs.readFileSync(paths.configFile, "utf8");
    const parsed = YAML.parse(raw) as FileConfig | null;
    if (!parsed || typeof parsed !== "object") return {};

    // Support flat or { athena: { ... } }
    const root = (parsed.athena && typeof parsed.athena === "object" ? parsed.athena : parsed) as FileConfig;

    const clientsRaw = root.athena_available_clients ?? root.athena?.athena_available_clients;
    let availableClients: string[] | undefined;
    if (Array.isArray(clientsRaw)) {
      availableClients = clientsRaw.filter(Boolean).map(String);
    } else if (typeof clientsRaw === "string") {
      availableClients = parseClientList(clientsRaw);
    }

    return {
      athena_base_url: root.athena_base_url ?? root.athena?.athena_base_url,
      athena_api_key: root.athena_api_key ?? root.athena?.athena_api_key,
      athena_default_client: root.athena_default_client ?? root.athena?.athena_default_client,
      athena_available_clients: availableClients,
      read_only: typeof root.read_only === "boolean" ? root.read_only : (typeof root.athena?.read_only === "boolean" ? root.athena.read_only : undefined),
      health_port: typeof root.health_port === "number" ? root.health_port : (typeof root.athena?.health_port === "number" ? root.athena.health_port : undefined),
      athena_admin_experimental_enabled:
        typeof root.athena_admin_experimental_enabled === "boolean"
          ? root.athena_admin_experimental_enabled
          : (typeof root.athena?.athena_admin_experimental_enabled === "boolean" ? root.athena.athena_admin_experimental_enabled : undefined),
    };
  } catch (err) {
    // Do not crash server on bad config file; fall back silently but note via stderr
    process.stderr.write(`[athena-mcp] Warning: failed to load ${paths.configFile}: ${String(err)}\n`);
    return {};
  }
}

export interface AthenaServerConfig {
  adminExperimentalEnabled: boolean;
  apiKey: string;
  availableClients: string[];
  baseUrl: string;
  defaultClient: string;
  healthPort?: number;
  readOnly: boolean;
}

interface CliArgs {
  adminExperimentalEnabled?: boolean;
  apiKey?: string;
  availableClients?: string[];
  client?: string;
  healthPort?: number;
  readOnly?: boolean;
  baseUrl?: string;
}

function parseCliArgs(): CliArgs {
  const out: CliArgs = {};
  const argv = process.argv.slice(2);
  const toKey = (s: string) => s.toLowerCase().replace(/-/g, "_");

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const match = arg.match(/^--([a-zA-Z0-9_-]+)(?:=(.+))?$/);
    if (!match) continue;

    const key = toKey(match[1]);
    const value = match[2] ?? argv[i + 1];
    const hasValue = value !== undefined && !String(value).startsWith("--");

    if (hasValue) {
      switch (key) {
        case "athena_base_url":
          out.baseUrl = String(value);
          break;
        case "athena_api_key":
          out.apiKey = String(value);
          break;
        case "athena_client":
        case "athena_default_client":
          out.client = String(value);
          break;
        case "athena_available_clients":
          out.availableClients = parseClientList(String(value));
          break;
        case "read_only":
        case "readonly":
          out.readOnly = parseBooleanFlag(String(value));
          break;
        case "health_port":
        case "healthport":
          out.healthPort = Number.parseInt(String(value), 10);
          break;
        case "athena_admin_experimental_enabled":
          out.adminExperimentalEnabled = parseBooleanFlag(String(value));
          break;
      }

      if (!match[2] && value === argv[i + 1]) i += 1;
      continue;
    }

    if (key === "read_only" || key === "readonly") {
      out.readOnly = true;
    }
    if (key === "athena_admin_experimental_enabled") {
      out.adminExperimentalEnabled = true;
    }
  }

  return out;
}

export function loadConfig(): AthenaServerConfig {
  const file = loadFileConfig();
  const cli = parseCliArgs();

  // Precedence: file < env < cli  (cli wins)
  const baseUrlRaw = (
    cli.baseUrl ??
    process.env.ATHENA_BASE_URL ??
    file.athena_base_url ??
    "https://mirror2.athena-cluster.com"
  ).trim();
  if (
    !baseUrlRaw.startsWith("http://") &&
    !baseUrlRaw.startsWith("https://")
  ) {
    throw new Error(
      `ATHENA_BASE_URL must start with http:// or https://, got: ${baseUrlRaw}`,
    );
  }

  const apiKey = (
    cli.apiKey ??
    process.env.ATHENA_API_KEY ??
    file.athena_api_key ??
    ""
  ).trim();

  // available clients: prefer explicit lists from higher precedence
  let availableClients: string[] =
    cli.availableClients ??
    parseClientList(process.env.ATHENA_AVAILABLE_CLIENTS) ??
    [];
  if (availableClients.length === 0 && file.athena_available_clients) {
    availableClients = Array.isArray(file.athena_available_clients)
      ? file.athena_available_clients
      : parseClientList(String(file.athena_available_clients));
  }

  const defaultClientRaw = (
    cli.client ??
    process.env.ATHENA_DEFAULT_CLIENT ??
    process.env.ATHENA_CLIENT ??
    file.athena_default_client ??
    availableClients[0] ??
    ""
  ).trim();

  const normalizedClients = availableClients.length
    ? availableClients
    : (defaultClientRaw ? [defaultClientRaw] : []);

  // Do not throw here: allow server to boot so MCP host gets a live connection.
  // Tool calls (via resolveClientName) and admin flows will surface clear configuration errors.
  const effectiveDefault = defaultClientRaw && normalizedClients.includes(defaultClientRaw)
    ? defaultClientRaw
    : (normalizedClients[0] ?? "");

  const fileReadOnly = typeof file.read_only === "boolean" ? file.read_only : undefined;
  const fileHealth = typeof file.health_port === "number" ? file.health_port : undefined;
  const fileAdminExp = typeof file.athena_admin_experimental_enabled === "boolean" ? file.athena_admin_experimental_enabled : undefined;

  return {
    adminExperimentalEnabled:
      cli.adminExperimentalEnabled ??
      parseBooleanFlag(process.env.ATHENA_ADMIN_EXPERIMENTAL_ENABLED) ??
      fileAdminExp ??
      false,
    apiKey,
    availableClients: normalizedClients,
    baseUrl: baseUrlRaw.replace(/\/+$/, ""),
    defaultClient: effectiveDefault,
    healthPort:
      cli.healthPort ??
      (process.env.HEALTH_PORT
        ? Number.parseInt(process.env.HEALTH_PORT, 10)
        : fileHealth),
    readOnly:
      cli.readOnly !== undefined
        ? cli.readOnly
        : process.env.READ_ONLY === "true"
          ? true
          : (fileReadOnly ?? false),
  };
}
