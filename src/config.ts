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
  const cli = parseCliArgs();

  const baseUrlRaw = (
    cli.baseUrl ??
    process.env.ATHENA_BASE_URL ??
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

  const apiKey = (cli.apiKey ?? process.env.ATHENA_API_KEY ?? "").trim();
  const availableClients =
    cli.availableClients ??
    parseClientList(process.env.ATHENA_AVAILABLE_CLIENTS) ??
    [];
  const defaultClient = (
    cli.client ??
    process.env.ATHENA_DEFAULT_CLIENT ??
    process.env.ATHENA_CLIENT ??
    availableClients[0] ??
    ""
  ).trim();

  if (!defaultClient) {
    throw new Error(
      "Configure ATHENA_CLIENT or ATHENA_DEFAULT_CLIENT, or supply ATHENA_AVAILABLE_CLIENTS.",
    );
  }

  const normalizedClients = availableClients.length
    ? availableClients
    : [defaultClient];
  if (!normalizedClients.includes(defaultClient)) {
    throw new Error(
      `Default Athena client "${defaultClient}" is not in ATHENA_AVAILABLE_CLIENTS.`,
    );
  }

  return {
    adminExperimentalEnabled:
      cli.adminExperimentalEnabled ??
      parseBooleanFlag(process.env.ATHENA_ADMIN_EXPERIMENTAL_ENABLED) ??
      false,
    apiKey,
    availableClients: normalizedClients,
    baseUrl: baseUrlRaw.replace(/\/+$/, ""),
    defaultClient,
    healthPort:
      cli.healthPort ??
      (process.env.HEALTH_PORT
        ? Number.parseInt(process.env.HEALTH_PORT, 10)
        : undefined),
    readOnly:
      cli.readOnly !== undefined
        ? cli.readOnly
        : process.env.READ_ONLY === "true",
  };
}
