#!/usr/bin/env node
/** @see https://nodejs.org/api/modules.html#__dirname - available in CJS output */
declare const __dirname: string;

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sanitizeIdentifier } from "./identifier.js";
import { isWriteQuery } from "./query.js";

// ─── Version (from package.json) ────────────────────────────────────────────

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = getVersion();

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = process.env.ATHENA_BASE_URL ?? "https://mcp.athena-db.com";
const API_KEY = process.env.ATHENA_API_KEY ?? "";
const ATHENA_CLIENT = process.env.ATHENA_CLIENT ?? "postgresql";
const READ_ONLY = process.env.READ_ONLY === "true";
const HEALTH_PORT = process.env.HEALTH_PORT ? parseInt(process.env.HEALTH_PORT, 10) : undefined;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

async function apiFetch(path: string, opts: FetchOptions = {}): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Athena-Client": ATHENA_CLIENT,
    ...(API_KEY ? { apikey: API_KEY, "x-api-key": API_KEY } : {}),
    ...(opts.headers ?? {}),
  };

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data;
}

async function runQuery(sql: string): Promise<unknown> {
  return apiFetch("/gateway/query", {
    method: "POST",
    body: { query: sql },
  });
}

// ─── MCP Server setup ─────────────────────────────────────────────────────────

const server = new McpServer({
  name: "athena-mcp",
  version: VERSION,
});

// ─── Tool: list_tables ────────────────────────────────────────────────────────

server.tool(
  "list_tables",
  "List all tables available in the connected PostgreSQL database",
  {},
  async () => {
    const data = await apiFetch("/schema/tables");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ─── Tool: list_extensions ────────────────────────────────────────────────────

server.tool(
  "list_extensions",
  "List all installed PostgreSQL extensions",
  {},
  async () => {
    const sql =
      "SELECT name, default_version, installed_version, comment " +
      "FROM pg_available_extensions " +
      "WHERE installed_version IS NOT NULL " +
      "ORDER BY name;";
    const data = await runQuery(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ─── Tool: list_migrations ────────────────────────────────────────────────────

server.tool(
  "list_migrations",
  "List applied database migrations",
  {
    table_name: z
      .string()
      .optional()
      .describe("Migrations table name (defaults to 'schema_migrations')"),
  },
  async ({ table_name }) => {
    const tbl = sanitizeIdentifier(table_name ?? "schema_migrations", "table_name");
    const sql = `SELECT * FROM ${tbl} ORDER BY 1;`;
    const data = await runQuery(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ─── Tool: apply_migration ────────────────────────────────────────────────────

server.tool(
  "apply_migration",
  "Apply a SQL migration against the connected database. Blocked when read_only mode is enabled.",
  {
    sql: z.string().describe("The SQL migration to execute"),
    name: z
      .string()
      .optional()
      .describe("Optional migration name / label for reference"),
  },
  async ({ sql, name }) => {
    if (READ_ONLY) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "apply_migration is disabled: server is running in read-only mode.",
          },
        ],
      };
    }

    const data = await runQuery(sql);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ migration: name ?? null, result: data }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: execute_sql ────────────────────────────────────────────────────────

server.tool(
  "execute_sql",
  "Execute a raw SQL query against the connected database. Write operations are blocked when read_only mode is enabled.",
  {
    query: z.string().describe("The SQL query to execute"),
    driver: z
      .enum(["athena", "postgresql", "supabase"])
      .optional()
      .describe("Driver to use (defaults to 'postgresql')"),
    db_name: z.string().optional().describe("Database name (used by /query/sql endpoint)"),
  },
  async ({ query, driver, db_name }) => {
    if (READ_ONLY) {
      if (isWriteQuery(query)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Write operations are disabled: server is running in read-only mode.",
            },
          ],
        };
      }
    }

    let data: unknown;
    if (driver && db_name) {
      data = await apiFetch("/query/sql", {
        method: "POST",
        body: { query, driver, db_name },
      });
    } else {
      data = await runQuery(query);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ─── Tool: get_logs ───────────────────────────────────────────────────────────

server.tool(
  "get_logs",
  "Retrieve recent database or application logs",
  {
    table_name: z
      .string()
      .optional()
      .describe("Logs table name (defaults to 'logs')"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of log rows to return (defaults to 100)"),
    level: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/, "Level must contain only alphanumeric characters, underscores, or hyphens")
      .optional()
      .describe("Filter by log level (e.g. 'error', 'warn', 'info')"),
  },
  async ({ table_name, limit, level }) => {
    const tbl = sanitizeIdentifier(table_name ?? "logs", "table_name");
    const n = limit ?? 100;
    const levelClause = level ? ` WHERE level = '${level.replace(/'/g, "''")}'` : "";
    const sql = `SELECT * FROM ${tbl}${levelClause} ORDER BY created_at DESC LIMIT ${n};`;
    const data = await runQuery(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

function startHealthServer(): void {
  if (HEALTH_PORT == null || HEALTH_PORT <= 0) return;

  const healthServer = createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: VERSION }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  healthServer.listen(HEALTH_PORT, () => {
    process.stderr.write(`athena-mcp health server listening on port ${HEALTH_PORT}\n`);
  });
}

async function main(): Promise<void> {
  startHealthServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `athena-mcp started (base_url=${BASE_URL}, client=${ATHENA_CLIENT}, read_only=${READ_ONLY}, version=${VERSION})\n`
  );
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
