import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { AthenaRuntime } from "./runtime.js";
import { registerAdminTools } from "./tools/admin-tools.js";
import { registerDataTools } from "./tools/data-tools.js";
import { registerStorageTools } from "./tools/storage-tools.js";
import { getVersion } from "./version.js";

const VERSION = getVersion();
const config = loadConfig();
const runtime = new AthenaRuntime(config);
const server = new McpServer({
  name: "athena-mcp",
  version: VERSION,
});

registerDataTools(server, runtime);
registerStorageTools(server, runtime);
registerAdminTools(server, runtime);

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

  healthServer.listen(config.healthPort, () => {
    process.stderr.write(
      `athena-mcp health server listening on port ${config.healthPort}\n`,
    );
  });
}

async function main(): Promise<void> {
  startHealthServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `athena-mcp started (base_url=${config.baseUrl}, client=${config.defaultClient}, allowed_clients=${config.availableClients.join(",")}, read_only=${config.readOnly}, admin_experimental=${config.adminExperimentalEnabled}, version=${VERSION})\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${String(error)}\n`);
  process.exit(1);
});
