#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = process.env.ATHENA_BASE_URL ?? "https://mcp.athena-db.com";
const API_KEY = process.env.ATHENA_API_KEY ?? "";
const ATHENA_CLIENT = process.env.ATHENA_CLIENT ?? "postgresql";
const READ_ONLY = process.env.READ_ONLY === "true";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

// Allow alphanumeric, underscores, dots, and dollar signs; optional schema prefix
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_$.]*(\.[a-zA-Z_][a-zA-Z0-9_$.]*)?$/;

function sanitizeIdentifier(name: string, label: string): string {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`Invalid ${label}: "${name}". Only alphanumeric characters, underscores, dots, and dollar signs are allowed.`);
  }
  return name;
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
  version: "1.0.0",
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
      const writePattern =
        /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|REPLACE)\b/i;
      if (writePattern.test(query)) {
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

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `athena-mcp started (base_url=${BASE_URL}, client=${ATHENA_CLIENT}, read_only=${READ_ONLY})\n`
  );
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
