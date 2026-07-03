import os from "node:os";
import path from "node:path";

export interface AthenaPaths {
  home: string;
  configFile: string;
  logsDir: string;
  statsFile: string;
  toolCallsLog: string; // jsonl
  mainLog: string; // current session-ish .log
}

export function getAthenaHome(): string {
  return path.join(os.homedir(), ".athena");
}

export function getAthenaPaths(): AthenaPaths {
  const home = getAthenaHome();
  const logsDir = path.join(home, "logs");
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return {
    home,
    configFile: path.join(home, "config.yaml"),
    logsDir,
    statsFile: path.join(home, "stats.json"),
    toolCallsLog: path.join(logsDir, `tool-calls-${date}.jsonl`),
    mainLog: path.join(logsDir, `athena-mcp-${date}.log`),
  };
}

export async function ensureAthenaDirs(): Promise<AthenaPaths> {
  const paths = getAthenaPaths();
  const { mkdir, writeFile, access } = await import("node:fs/promises");
  await mkdir(paths.home, { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });

  // Write a helpful example config if none exists yet
  try {
    await access(paths.configFile);
  } catch {
    const example = `# Athena MCP configuration (~/.athena/config.yaml)
# These values are used as defaults. Environment variables and CLI flags take precedence.
#
# athena:
#   base_url: https://mirror2.athena-cluster.com
#   api_key: "your-api-key-here"
#   default_client: "primary"
#   available_clients:
#     - primary
#     - analytics
#   read_only: false
#   health_port: 0
#   athena_admin_experimental_enabled: false
#
# You can also use the flat form without the 'athena:' wrapper.

athena:
  base_url: https://mirror2.athena-cluster.com
  # api_key: ""
  # default_client: ""
  # available_clients: []
  read_only: false
  athena_admin_experimental_enabled: false
`;
    await writeFile(paths.configFile, example, "utf8");
  }

  return paths;
}
