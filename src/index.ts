import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { AthenaRuntime } from "./runtime.js";
import { registerAdminTools } from "./tools/admin-tools.js";
import { registerAuthTools } from "./tools/auth-tools.js";
import { registerChatTools } from "./tools/chat-tools.js";
import { registerDataTools } from "./tools/data-tools.js";
import { registerGatewayTools } from "./tools/gateway-tools.js";
import { registerSdkDbTools } from "./tools/sdk-db-tools.js";
import { registerStorageTools } from "./tools/storage-tools.js";
import { getVersion } from "./version.js";
import { logger } from "./logger.js";
import { getAthenaPaths } from "./paths.js";

const VERSION = getVersion();

function setupGlobalErrorHandlers(): void {
  process.on("uncaughtException", (err) => {
    logger.error("UNCAUGHT EXCEPTION - preventing abrupt stop", {
      error: err?.message || String(err),
      stack: err?.stack,
    }).catch(() => {});
    // Log to stderr directly as last resort
    process.stderr.write(`[FATAL] Uncaught exception: ${err?.stack || err}\n`);
    // Do not exit immediately; MCP hosts expect long-running process.
    // In extreme cases the host will restart us.
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("UNHANDLED REJECTION", {
      reason: String(reason),
      stack: (reason as any)?.stack,
    }).catch(() => {});
    process.stderr.write(`[FATAL] Unhandled rejection: ${String(reason)}\n`);
  });

  process.on("SIGINT", async () => {
    await logger.info("Received SIGINT, shutting down").catch(() => {});
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await logger.info("Received SIGTERM, shutting down").catch(() => {});
    process.exit(0);
  });
}

const config = loadConfig();
const runtime = new AthenaRuntime(config);
const server = new McpServer({
  name: "athena-mcp",
  version: VERSION,
});

registerDataTools(server, runtime);
registerStorageTools(server, runtime);
registerAdminTools(server, runtime);
registerAuthTools(server, runtime);
registerChatTools(server, runtime);
registerSdkDbTools(server, runtime);
registerGatewayTools(server, runtime);

function startHealthServer(): void {
  if (config.healthPort == null || config.healthPort <= 0) return;

  const healthServer = createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: VERSION }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  healthServer.on("error", (err) => {
    logger.error(`Health server error on port ${config.healthPort}`, { error: err.message }).catch(() => {});
    process.stderr.write(`athena-mcp health server error on port ${config.healthPort}: ${err.message}\n`);
  });

  healthServer.listen(config.healthPort, () => {
    const msg = `athena-mcp health server listening on port ${config.healthPort}`;
    process.stderr.write(msg + "\n");
    logger.info(msg).catch(() => {});
  });
}

function redactConfigForLog(cfg: any) {
  const copy = { ...cfg };
  if (copy.apiKey) copy.apiKey = copy.apiKey ? "[REDACTED]" : "";
  return copy;
}

async function main(): Promise<void> {
  setupGlobalErrorHandlers();

  // Ensure ~/.athena structure + start logging to files
  await logger.init();

  const paths = getAthenaPaths();
  await logger.info("Athena MCP starting", {
    version: VERSION,
    home: paths.home,
    configFile: paths.configFile,
    logsDir: paths.logsDir,
  });

  startHealthServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const startupMsg = `athena-mcp started (base_url=${config.baseUrl}, client=${config.defaultClient}, allowed_clients=${config.availableClients.join(",")}, read_only=${config.readOnly}, admin_experimental=${config.adminExperimentalEnabled}, version=${VERSION})`;
  process.stderr.write(startupMsg + "\n");

  await logger.info("MCP server connected and ready", {
    config: redactConfigForLog(config),
    paths,
    statsSnapshot: logger.getStatsSnapshot(),
  });
}

main().catch(async (error) => {
  await logger.error("Fatal startup error", { error: String(error), stack: (error as any)?.stack }).catch(() => {});
  process.stderr.write(`Fatal error: ${String(error)}\n`);
  process.exit(1);
});
