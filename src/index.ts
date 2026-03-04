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
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = getVersion();

// ─── Configuration ────────────────────────────────────────────────────────────

function parseCliArgs(): {
  baseUrl?: string;
  apiKey?: string;
  client?: string;
  readOnly?: boolean;
  healthPort?: number;
} {
  const out: ReturnType<typeof parseCliArgs> = {};
  const argv = process.argv.slice(2);
  const toKey = (s: string) => s.toLowerCase().replace(/-/g, "_");
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const match = arg.match(/^--([a-zA-Z0-9_-]+)(?:=(.+))?$/);
    if (!match) continue;
    const key = toKey(match[1]);
    const value = match[2] ?? argv[i + 1];
    if (value !== undefined && !String(value).startsWith("--")) {
      if (key === "read_only" || key === "readonly") {
        out.readOnly = value === "true" || value === "1";
      } else if (key === "health_port" || key === "healthport") {
        out.healthPort = parseInt(String(value), 10);
      } else if (key === "athena_base_url") {
        out.baseUrl = String(value);
      } else if (key === "athena_api_key") {
        out.apiKey = String(value);
      } else if (key === "athena_client") {
        out.client = String(value);
      }
      if (!match[2] && value === argv[i + 1]) i++;
    } else if (key === "read_only" || key === "readonly") {
      out.readOnly = true;
    }
  }
  return out;
}

const cli = parseCliArgs();

const BASE_URL_RAW = (
  cli.baseUrl ??
  process.env.ATHENA_BASE_URL ??
  "https://mirror3.athena-db.com"
).trim();
if (
  !BASE_URL_RAW.startsWith("http://") &&
  !BASE_URL_RAW.startsWith("https://")
) {
  throw new Error(
    `ATHENA_BASE_URL must start with http:// or https://, got: ${BASE_URL_RAW}`,
  );
}
const BASE_URL = BASE_URL_RAW.replace(/\/+$/, "");
const API_KEY = (cli.apiKey ?? process.env.ATHENA_API_KEY ?? "").trim();
const ATHENA_CLIENT = (
  cli.client ??
  process.env.ATHENA_CLIENT ??
  "railway_direct"
).trim();
const READ_ONLY =
  cli.readOnly !== undefined
    ? !!cli.readOnly
    : process.env.READ_ONLY === "true";
const HEALTH_PORT =
  cli.healthPort ??
  (process.env.HEALTH_PORT ? parseInt(process.env.HEALTH_PORT, 10) : undefined);

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

async function apiFetch(
  path: string,
  opts: FetchOptions = {},
): Promise<unknown> {
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;
  const url = `${BASE_URL}${normalizedPath}`;
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
    throw new Error(
      `HTTP ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
    );
  }

  return data;
}

async function runQuery(sql: string): Promise<unknown> {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  return apiFetch("/gateway/query", {
    method: "POST",
    body: { query: trimmed },
  });
}

async function getPrimaryKeyColumns(
  schema: string,
  table: string,
): Promise<Set<string>> {
  try {
    const schemaLit = schema.replace(/'/g, "''");
    const tableLit = table.replace(/'/g, "''");
    const rows = queryResultToArray(
      await runQuery(
        `SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = '${schemaLit}' AND tc.table_name = '${tableLit}'`,
      ),
    ) as Array<{ column_name?: string }>;
    return new Set(rows.map((r) => (r.column_name ?? "").toLowerCase()));
  } catch {
    return new Set();
  }
}

function queryResultToArray(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.rows)) return r.rows;
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(r.result)) return r.result;
  }
  return [];
}

interface TableRef {
  schema: string;
  table: string;
  qualified: string;
}

function parseTableRef(table: string, defaultSchema?: string): TableRef {
  const schemaDefault = sanitizeIdentifier(defaultSchema ?? "public", "schema");
  if (table.includes(".")) {
    const [schemaPart, tablePart] = table.split(".", 2);
    const schemaName = sanitizeIdentifier(schemaPart.trim(), "schema");
    const tableName = sanitizeIdentifier(tablePart.trim(), "table");
    return {
      schema: schemaName,
      table: tableName,
      qualified: `${schemaName}.${tableName}`,
    };
  }

  const tableName = sanitizeIdentifier(table, "table");
  const qualified =
    schemaDefault === "public" ? tableName : `${schemaDefault}.${tableName}`;
  return {
    schema: schemaDefault,
    table: tableName,
    qualified,
  };
}

function jsonContent(data: unknown): {
  content: [{ type: "text"; text: string }];
} {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function textContent(text: string): {
  content: [{ type: "text"; text: string }];
} {
  return {
    content: [{ type: "text", text }],
  };
}

function readOnlyToolError(toolName: string): {
  isError: true;
  content: [{ type: "text"; text: string }];
} {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `${toolName} is disabled: server is running in read-only mode.`,
      },
    ],
  };
}

const managementColumnSchema = z.object({
  name: z.string().describe("Column name"),
  data_type: z.string().describe("PostgreSQL data type"),
  nullable: z.boolean().optional().describe("Whether the column is nullable"),
  default_expression: z
    .string()
    .optional()
    .describe("Optional SQL default expression"),
});

const editTableOperationSchema = z.union([
  z.object({
    type: z.literal("add_column"),
    column: managementColumnSchema,
  }),
  z.object({
    type: z.literal("rename_column"),
    from: z.string(),
    to: z.string(),
  }),
  z.object({
    type: z.literal("set_default"),
    column_name: z.string(),
    default_expression: z.string(),
  }),
  z.object({
    type: z.literal("drop_default"),
    column_name: z.string(),
  }),
  z.object({
    type: z.literal("set_not_null"),
    column_name: z.string(),
  }),
  z.object({
    type: z.literal("drop_not_null"),
    column_name: z.string(),
  }),
]);

const pipelineConditionSchema = z.object({
  eq_column: z.string(),
  eq_value: z.string(),
});

const pipelineSourceSchema = z.object({
  table_name: z.string().optional(),
  view_name: z.string().optional(),
  columns: z.array(z.string()).optional(),
  conditions: z.array(pipelineConditionSchema).optional(),
  limit: z.number().int().positive().optional(),
});

const pipelineTransformSchema = z.object({
  group_by: z.string().optional(),
  time_granularity: z.enum(["day", "hour", "minute"]).optional(),
  aggregation_column: z.string().optional(),
  aggregation_strategy: z.enum(["cumulative_sum"]).optional(),
  aggregation_dedup: z.boolean().optional(),
});

const pipelineSinkSchema = z.object({
  table_name: z.string().optional(),
});

const createApiKeySchema = z.object({
  name: z.string().describe("Human-readable API key name"),
  description: z.string().optional().describe("Optional description"),
  client_name: z
    .string()
    .optional()
    .describe("Optional client binding for this key"),
  expires_at: z
    .string()
    .optional()
    .describe("Optional ISO date-time expiry"),
  rights: z.array(z.string()).optional().describe("Rights to grant"),
});

const updateApiKeySchema = z.object({
  id: z.string().describe("API key UUID"),
  name: z.string().optional(),
  description: z.string().optional(),
  client_name: z.string().optional(),
  expires_at: z.string().optional(),
  is_active: z.boolean().optional(),
  rights: z.array(z.string()).optional(),
});

const apiKeyRightSchema = z.object({
  name: z.string().describe("Right name"),
  description: z.string().optional().describe("Optional description"),
});

const saveAthenaClientSchema = z.object({
  client_name: z.string().describe("Athena client name"),
  description: z.string().optional(),
  pg_uri: z.string().optional(),
  pg_uri_env_var: z.string().optional(),
  is_active: z.boolean().optional(),
});

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
  },
);

// ─── Tool: list_extensions ────────────────────────────────────────────────────

server.tool(
  "list_extensions",
  "List all installed PostgreSQL extensions. May return empty if the gateway does not expose extension metadata.",
  {},
  async () => {
    try {
      const data = await runQuery(
        "SELECT extname AS name, extversion AS installed_version FROM pg_extension ORDER BY extname",
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Extension metadata not available via this client",
                extensions: [],
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
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
    const tbl = sanitizeIdentifier(
      table_name ?? "schema_migrations",
      "table_name",
    );
    const sql = `SELECT * FROM ${tbl} ORDER BY 1`;
    const data = await runQuery(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
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
          text: JSON.stringify(
            { migration: name ?? null, result: data },
            null,
            2,
          ),
        },
      ],
    };
  },
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
    db_name: z
      .string()
      .optional()
      .describe("Database name (used by /query/sql endpoint)"),
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
      const trimmed = query.trim().replace(/;\s*$/, "");
      data = await apiFetch("/query/sql", {
        method: "POST",
        body: { query: trimmed, driver, db_name },
      });
    } else {
      data = await runQuery(query);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
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
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Level must contain only alphanumeric characters, underscores, or hyphens",
      )
      .optional()
      .describe("Filter by log level (e.g. 'error', 'warn', 'info')"),
  },
  async ({ table_name, limit, level }) => {
    const tbl = sanitizeIdentifier(table_name ?? "logs", "table_name");
    const n = limit ?? 100;
    const levelClause = level
      ? ` WHERE level = '${level.replace(/'/g, "''")}'`
      : "";
    const sql = `SELECT * FROM ${tbl}${levelClause} ORDER BY created_at DESC LIMIT ${n}`;
    const data = await runQuery(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ─── Tool: get_columns_of_table ────────────────────────────────────────────

server.tool(
  "get_columns_of_table",
  "Describe columns for a table using Athena's schema API",
  {
    table: z
      .string()
      .describe("Table name (optionally schema-qualified) to describe"),
    schema: z
      .string()
      .optional()
      .describe(
        "Optional schema name when the table name is not schema-qualified",
      ),
  },
  async ({ table, schema }) => {
    const ref = parseTableRef(table, schema);
    const pkColumns = await getPrimaryKeyColumns(ref.schema, ref.table);
    const data = (await apiFetch(
      `/schema/columns?table_name=${encodeURIComponent(ref.qualified)}`,
    )) as {
      columns?: Array<Record<string, unknown>>;
    };
    if (Array.isArray(data?.columns) && data.columns.length > 0) {
      const columns = data.columns.map((c) => ({
        ...c,
        primary_key: pkColumns.has(String(c.column_name ?? "").toLowerCase()),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ columns }, null, 2) }],
      };
    }
    try {
      const schemaLit = ref.schema.replace(/'/g, "''");
      const tableLit = ref.table.replace(/'/g, "''");
      const rows = queryResultToArray(
        await runQuery(
          `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = '${schemaLit}' AND table_name = '${tableLit}' ORDER BY ordinal_position`,
        ),
      ) as Array<Record<string, unknown>>;
      const columns = rows.map((r) => ({
        column_name: r.column_name,
        data_type: r.data_type,
        column_default: r.column_default,
        is_nullable: r.is_nullable,
        primary_key: pkColumns.has(String(r.column_name ?? "").toLowerCase()),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ columns }, null, 2) }],
      };
    } catch {
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  },
);

// ─── Tool: list_table_metadata ────────────────────────────────────────────

server.tool(
  "list_table_metadata",
  "Return the full metadata for a table: schema name, table name, and each column's name, type, default value, and nullable flag",
  {
    table: z.string().describe("Table name (optionally schema-qualified)"),
    schema: z
      .string()
      .optional()
      .describe(
        "Optional schema name when the table name is not schema-qualified",
      ),
  },
  async ({ table, schema }) => {
    const ref = parseTableRef(table, schema);
    const pkColumns = await getPrimaryKeyColumns(ref.schema, ref.table);
    const raw = (await apiFetch(
      `/schema/columns?table_name=${encodeURIComponent(ref.qualified)}`,
    )) as {
      columns?: Array<{
        column_name?: string;
        data_type?: string;
        column_default?: string | null;
        is_nullable?: string | null;
      }>;
    };
    let columns = Array.isArray(raw?.columns) ? raw.columns : [];
    if (columns.length === 0) {
      try {
        const schemaLit = ref.schema.replace(/'/g, "''");
        const tableLit = ref.table.replace(/'/g, "''");
        const rows = queryResultToArray(
          await runQuery(
            `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = '${schemaLit}' AND table_name = '${tableLit}' ORDER BY ordinal_position`,
          ),
        ) as Array<{
          column_name?: string;
          data_type?: string;
          column_default?: string | null;
          is_nullable?: string;
        }>;
        columns = rows;
      } catch {
        columns = [];
      }
    }
    const metadata = {
      schema: ref.schema,
      table: ref.table,
      qualified: ref.qualified,
      columns: Array.isArray(columns)
        ? columns.map((c) => ({
            name: c.column_name ?? "",
            type: c.data_type ?? "unknown",
            nullable: (c.is_nullable ?? "YES").toUpperCase() === "YES",
            default: c.column_default ?? null,
            primary_key: pkColumns.has((c.column_name ?? "").toLowerCase()),
          }))
        : [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(metadata, null, 2) }],
    };
  },
);

// ─── Tool: list_schemas ───────────────────────────────────────────────────

server.tool(
  "list_schemas",
  "List database schemas visible to the current Athena client",
  {
    include_system: z
      .boolean()
      .optional()
      .describe(
        "Include system schemas such as pg_catalog and information_schema",
      ),
  },
  async ({ include_system }) => {
    const data = (await apiFetch("/schema/tables")) as {
      tables?: Array<{ table_schema?: string }>;
    };
    const tables = Array.isArray(data?.tables) ? data.tables : [];
    const schemas = [
      ...new Set(tables.map((t) => t.table_schema ?? "").filter(Boolean)),
    ].sort();
    const filtered = include_system
      ? schemas
      : schemas.filter(
          (s) => !s.startsWith("pg_") && s !== "information_schema",
        );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            filtered.map((s) => ({ schema_name: s })),
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Tool: list_views ─────────────────────────────────────────────────────

server.tool(
  "list_views",
  "List visible views (and optionally materialized views). Uses Athena schema API.",
  {
    schema: z
      .string()
      .optional()
      .describe("Schema to limit the view lookup to"),
    include_materialized: z
      .boolean()
      .optional()
      .describe("Include materialized views (when supported by schema API)"),
  },
  async ({ schema, include_materialized }) => {
    const data = (await apiFetch("/schema/tables")) as {
      tables?: Array<{
        table_schema?: string;
        table_name?: string;
        table_type?: string;
      }>;
    };
    const tables = Array.isArray(data?.tables) ? data.tables : [];
    const wantView = (t: { table_type?: string }) =>
      t.table_type === "VIEW" || t.table_type === "view";
    const wantMatView = (t: { table_type?: string }) =>
      t.table_type === "MATERIALIZED VIEW" ||
      t.table_type === "materialized view";
    const filtered = tables.filter((t) => {
      if (schema && (t.table_schema ?? "") !== schema) return false;
      if (
        (t.table_schema ?? "").startsWith("pg_") ||
        (t.table_schema ?? "") === "information_schema"
      )
        return false;
      return wantView(t) || (include_materialized !== false && wantMatView(t));
    });
    const result = filtered
      .map((t) => ({ table_schema: t.table_schema, table_name: t.table_name }))
      .sort((a, b) =>
        `${a.table_schema}.${a.table_name}`.localeCompare(
          `${b.table_schema}.${b.table_name}`,
        ),
      );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ─── Tool: list_foreign_keys ──────────────────────────────────────────────

server.tool(
  "list_foreign_keys",
  "List primary keys, foreign keys, and unique constraints for a table. Essential for understanding relationships and correct joins.",
  {
    table: z.string().describe("Table name (optionally schema-qualified)"),
    schema: z
      .string()
      .optional()
      .describe("Optional schema when table name is not schema-qualified"),
  },
  async ({ table, schema }) => {
    const ref = parseTableRef(table, schema);
    const schemaLit = ref.schema.replace(/'/g, "''");
    const tableLit = ref.table.replace(/'/g, "''");
    try {
      const data = await runQuery(
        `SELECT tc.constraint_type, tc.constraint_name, kcu.column_name, ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema WHERE tc.table_schema = '${schemaLit}' AND tc.table_name = '${tableLit}' AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE') ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Constraint metadata not available via this client",
                constraints: [],
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
);

// ─── Tool: get_table_sample ────────────────────────────────────────────────

server.tool(
  "get_table_sample",
  "Sample rows from a table to understand its data shape. Quick alternative to writing SQL.",
  {
    table: z.string().describe("Table name (optionally schema-qualified)"),
    schema: z
      .string()
      .optional()
      .describe("Optional schema when table name is not schema-qualified"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Number of rows to sample (defaults to 10)"),
  },
  async ({ table, schema, limit }) => {
    const ref = parseTableRef(table, schema);
    const n = limit ?? 10;
    const sql = `SELECT * FROM ${ref.qualified} LIMIT ${n}`;
    const data = await runQuery(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ─── Tool: list_indexes ────────────────────────────────────────────────────

server.tool(
  "list_indexes",
  "List index definitions for a table. Helps with performance and query design.",
  {
    table: z.string().describe("Table name (optionally schema-qualified)"),
    schema: z
      .string()
      .optional()
      .describe("Optional schema when table name is not schema-qualified"),
  },
  async ({ table, schema }) => {
    const ref = parseTableRef(table, schema);
    const schemaLit = ref.schema.replace(/'/g, "''");
    const tableLit = ref.table.replace(/'/g, "''");
    try {
      const raw = queryResultToArray(
        await runQuery(
          `SELECT indexname AS index_name, indexdef AS index_def FROM pg_indexes WHERE schemaname = '${schemaLit}' AND tablename = '${tableLit}' ORDER BY indexname`,
        ),
      ) as Array<Record<string, unknown>>;
      const data = raw.map((r) => ({
        index_name: r.index_name,
        index_def: r.index_def,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Index metadata not available via this client",
                indexes: [],
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
);

// ─── Tool: search_columns ───────────────────────────────────────────────────

server.tool(
  "search_columns",
  "Find tables and columns by name pattern. Speeds up schema discovery.",
  {
    pattern: z
      .string()
      .describe("Column or table name pattern (SQL LIKE, use % for wildcard)"),
    schema: z.string().optional().describe("Optional schema to limit search"),
  },
  async ({ pattern, schema }) => {
    const patternLit = pattern.replace(/'/g, "''");
    const schemaFilter = schema
      ? `AND c.table_schema = '${sanitizeIdentifier(schema, "schema")}'`
      : "AND c.table_schema NOT IN ('pg_catalog', 'information_schema')";
    const schemaCond = schema
      ? `c.table_schema = '${sanitizeIdentifier(schema, "schema").replace(/'/g, "''")}'`
      : "c.table_schema NOT IN ('pg_catalog', 'information_schema')";
    try {
      const data = await runQuery(
        `SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable FROM information_schema.columns c WHERE (LOWER(c.column_name) LIKE LOWER('${patternLit}') OR LOWER(c.table_name) LIKE LOWER('${patternLit}')) AND ${schemaCond} ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message:
                  "Column search not available via this client; use list_tables and get_columns_of_table instead",
                results: [],
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
);

// ─── Tool: get_row_by_id ───────────────────────────────────────────────────

server.tool(
  "get_row_by_id",
  "Fetch rows by primary key column value. Simplifies the common fetch-by-id use case.",
  {
    table: z.string().describe("Table name (optionally schema-qualified)"),
    id: z
      .union([z.string(), z.number()])
      .describe("Primary key value (typically id)"),
    id_column: z
      .string()
      .optional()
      .describe("Primary key column name (defaults to 'id')"),
    schema: z
      .string()
      .optional()
      .describe("Optional schema when table name is not schema-qualified"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum rows to return (defaults to 100)"),
  },
  async ({ table, id, id_column, schema, limit }) => {
    const ref = parseTableRef(table, schema);
    const columnName = sanitizeIdentifier(id_column ?? "id", "id_column");
    const payload = {
      table_name: ref.qualified,
      conditions: [{ eq_column: columnName, eq_value: String(id) }],
      limit: limit ?? 100,
    };
    const data = await apiFetch("/gateway/fetch", {
      method: "POST",
      body: payload,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ─── Tool: list_all_table_metadata ─────────────────────────────────────────

server.tool(
  "list_all_table_metadata",
  "Return metadata for all tables in one call: schema, name, columns, types, defaults, nullable. Uses Athena schema API.",
  {
    schema: z
      .string()
      .optional()
      .describe("Optional schema to limit to (default: all user schemas)"),
  },
  async ({ schema }) => {
    const tablesData = (await apiFetch("/schema/tables")) as {
      tables?: Array<{ table_schema?: string; table_name?: string }>;
    };
    const tables = Array.isArray(tablesData?.tables) ? tablesData.tables : [];
    const filtered = schema
      ? tables.filter((t) => (t.table_schema ?? "") === schema)
      : tables.filter(
          (t) =>
            !(t.table_schema ?? "").startsWith("pg_") &&
            (t.table_schema ?? "") !== "information_schema",
        );
    const metadata: Array<{
      schema: string;
      table: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        default: string | null;
        primary_key: boolean;
      }>;
    }> = [];
    for (const t of filtered) {
      const tableSchema = t.table_schema ?? "public";
      const tableNameForApi = t.table_name ?? "";
      const schemaLit = tableSchema.replace(/'/g, "''");
      const tableLit = tableNameForApi.replace(/'/g, "''");
      const pkColumns = await getPrimaryKeyColumns(
        tableSchema,
        tableNameForApi,
      );
      let cols: Array<{
        column_name?: string;
        data_type?: string;
        column_default?: string | null;
        is_nullable?: string;
      }> = [];
      try {
        const colData = (await apiFetch(
          `/schema/columns?table_name=${encodeURIComponent(tableNameForApi)}`,
        )) as {
          columns?: Array<{
            column_name?: string;
            data_type?: string;
            column_default?: string | null;
            is_nullable?: string;
          }>;
        };
        cols = Array.isArray(colData?.columns) ? colData.columns : [];
      } catch {
        cols = [];
      }
      if (cols.length === 0) {
        try {
          const rows = queryResultToArray(
            await runQuery(
              `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = '${schemaLit}' AND table_name = '${tableLit}' ORDER BY ordinal_position`,
            ),
          ) as Array<{
            column_name?: string;
            data_type?: string;
            column_default?: string | null;
            is_nullable?: string;
          }>;
          cols = rows;
        } catch {
          cols = [];
        }
      }
      metadata.push({
        schema: t.table_schema ?? "",
        table: t.table_name ?? "",
        columns: Array.isArray(cols)
          ? cols.map((c) => ({
              name: c.column_name ?? "",
              type: c.data_type ?? "unknown",
              nullable: (c.is_nullable ?? "YES").toUpperCase() === "YES",
              default: c.column_default ?? null,
              primary_key: pkColumns.has((c.column_name ?? "").toLowerCase()),
            }))
          : [],
      });
    }
    metadata.sort((a, b) =>
      `${a.schema}.${a.table}`.localeCompare(`${b.schema}.${b.table}`),
    );
    return {
      content: [{ type: "text", text: JSON.stringify(metadata, null, 2) }],
    };
  },
);

// ─── Tool: insert_row ──────────────────────────────────────────────────────

server.tool(
  "insert_row",
  "Insert a row into a table. Blocked when read_only mode is enabled.",
  {
    table: z.string().describe("Table name (optionally schema-qualified)"),
    data: z
      .record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()]),
      )
      .describe("Row data as key-value pairs"),
    schema: z
      .string()
      .optional()
      .describe("Optional schema when table name is not schema-qualified"),
  },
  async ({ table, data, schema }) => {
    if (READ_ONLY) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "insert_row is disabled: server is running in read-only mode.",
          },
        ],
      };
    }
    const ref = parseTableRef(table, schema);
    const insert_body = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        sanitizeIdentifier(k, "column"),
        v,
      ]),
    );
    const payload = { table_name: ref.qualified, insert_body };
    const result = await apiFetch("/gateway/insert", {
      method: "PUT",
      body: payload,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ─── Tool: delete_row ───────────────────────────────────────────────────────

server.tool(
  "delete_row",
  "Delete a row by primary key (resource_id). Blocked when read_only mode is enabled.",
  {
    table: z.string().describe("Table name (optionally schema-qualified)"),
    resource_id: z.string().describe("Primary key value of the row to delete"),
    schema: z
      .string()
      .optional()
      .describe("Optional schema when table name is not schema-qualified"),
  },
  async ({ table, resource_id, schema }) => {
    if (READ_ONLY) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "delete_row is disabled: server is running in read-only mode.",
          },
        ],
      };
    }
    const ref = parseTableRef(table, schema);
    const payload = { table_name: ref.qualified, resource_id };
    const result = await apiFetch("/gateway/delete", {
      method: "DELETE",
      body: payload,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ─── Tool: update_row ───────────────────────────────────────────────────────

server.tool(
  "update_row",
  "Update rows matching a condition. Blocked when read_only mode is enabled.",
  {
    table: z.string().describe("Table name (optionally schema-qualified)"),
    set: z
      .record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()]),
      )
      .describe("Column-value pairs to set"),
    where_column: z.string().describe("Column to match in WHERE clause"),
    where_value: z
      .union([z.string(), z.number(), z.boolean()])
      .describe("Value to match (converted to string)"),
    schema: z
      .string()
      .optional()
      .describe("Optional schema when table name is not schema-qualified"),
  },
  async ({ table, set, where_column, where_value, schema }) => {
    if (READ_ONLY) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "update_row is disabled: server is running in read-only mode.",
          },
        ],
      };
    }
    const ref = parseTableRef(table, schema);
    const whereCol = sanitizeIdentifier(where_column, "where_column");
    function toSqlLiteral(val: string | number | boolean | null): string {
      if (val === null) return "NULL";
      if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
      if (typeof val === "number") return String(val);
      return `'${String(val).replace(/'/g, "''")}'`;
    }
    const setParts = Object.entries(set).map(([col, val]) => {
      const c = sanitizeIdentifier(col, "column");
      return `${c} = ${toSqlLiteral(val as string | number | boolean | null)}`;
    });
    const whereVal = toSqlLiteral(where_value);
    const sql = `UPDATE ${ref.qualified} SET ${setParts.join(", ")} WHERE ${whereCol} = ${whereVal}`;
    const data = await runQuery(sql);
    return {
      content: [
        { type: "text", text: JSON.stringify({ result: data }, null, 2) },
      ],
    };
  },
);

// ─── Tool: get_row_by_eq_column_of_table ──────────────────────────────────

server.tool(
  "get_row_by_eq_column_of_table",
  "Fetch rows from a table where `column = value` using Athena's fetch endpoint",
  {
    table: z
      .string()
      .describe("Table name to query (optionally schema-qualified)"),
    column: z.string().describe("Column name to match against"),
    value: z
      .union([z.string(), z.number(), z.boolean()])
      .describe("Value to compare (converted to string for Athena)"),
    schema: z
      .string()
      .optional()
      .describe("Optional schema to override the table name"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of rows to return (defaults to 100)"),
  },
  async ({ table, column, value, schema, limit }) => {
    const ref = parseTableRef(table, schema);
    const columnName = sanitizeIdentifier(column, "column");
    const payload = {
      table_name: ref.qualified,
      conditions: [
        {
          eq_column: columnName,
          eq_value: String(value),
        },
      ],
      limit: limit ?? 100,
    };
    const data = await apiFetch("/gateway/fetch", {
      method: "POST",
      body: payload,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// ─── Tool: get_api_root ─────────────────────────────────────────────────────

server.tool(
  "get_api_root",
  "Fetch Athena API root metadata, including the advertised route list.",
  {},
  async () => jsonContent(await apiFetch("/")),
);

// ─── Tool: ping ─────────────────────────────────────────────────────────────

server.tool("ping", "Run the Athena health check endpoint.", {}, async () => {
  const data = await apiFetch("/ping");
  return textContent(String(data));
});

// ─── Tool: get_cluster_health ───────────────────────────────────────────────

server.tool(
  "get_cluster_health",
  "Check Athena mirror reachability, latency, throughput, and version metadata.",
  {},
  async () => jsonContent(await apiFetch("/health/cluster")),
);

// ─── Tool: get_management_capabilities ─────────────────────────────────────

server.tool(
  "get_management_capabilities",
  "List Athena management API capabilities and required rights for the current client.",
  {},
  async () => jsonContent(await apiFetch("/management/capabilities")),
);

// ─── Tool: create_table ─────────────────────────────────────────────────────

server.tool(
  "create_table",
  "Create a managed table through Athena's management API. Blocked when read_only mode is enabled.",
  {
    table_name: z.string().describe("Table name to create"),
    schema_name: z
      .string()
      .optional()
      .describe("Schema name (defaults to public)"),
    columns: z
      .array(managementColumnSchema)
      .optional()
      .describe("Optional column definitions"),
    if_not_exists: z
      .boolean()
      .optional()
      .describe("Compatibility flag accepted by Athena"),
  },
  async ({ table_name, schema_name, columns, if_not_exists }) => {
    if (READ_ONLY) return readOnlyToolError("create_table");
    return jsonContent(
      await apiFetch("/management/tables", {
        method: "POST",
        body: { table_name, schema_name, columns, if_not_exists },
      }),
    );
  },
);

// ─── Tool: edit_table ───────────────────────────────────────────────────────

server.tool(
  "edit_table",
  "Apply safe additive ALTER TABLE operations through Athena's management API. Blocked when read_only mode is enabled.",
  {
    table_name: z.string().describe("Target table name"),
    schema_name: z
      .string()
      .optional()
      .describe("Schema name (defaults to public)"),
    operations: z
      .array(editTableOperationSchema)
      .describe("Ordered table alteration operations"),
  },
  async ({ table_name, schema_name, operations }) => {
    if (READ_ONLY) return readOnlyToolError("edit_table");
    return jsonContent(
      await apiFetch(`/management/tables/${encodeURIComponent(table_name)}`, {
        method: "PATCH",
        body: { schema_name, operations },
      }),
    );
  },
);

// ─── Tool: drop_table ───────────────────────────────────────────────────────

server.tool(
  "drop_table",
  "Drop a managed table through Athena's management API. Blocked when read_only mode is enabled.",
  {
    table_name: z.string().describe("Target table name"),
    schema_name: z
      .string()
      .optional()
      .describe("Schema name (defaults to public)"),
    cascade: z.boolean().optional().describe("Whether to cascade the drop"),
  },
  async ({ table_name, schema_name, cascade }) => {
    if (READ_ONLY) return readOnlyToolError("drop_table");
    return jsonContent(
      await apiFetch(`/management/tables/${encodeURIComponent(table_name)}`, {
        method: "DELETE",
        body: { schema_name, cascade },
      }),
    );
  },
);

// ─── Tool: drop_column ──────────────────────────────────────────────────────

server.tool(
  "drop_column",
  "Drop a managed table column through Athena's management API. Blocked when read_only mode is enabled.",
  {
    table_name: z.string().describe("Target table name"),
    column_name: z.string().describe("Column name to drop"),
    schema_name: z
      .string()
      .optional()
      .describe("Schema name (defaults to public)"),
    cascade: z.boolean().optional().describe("Whether to cascade the drop"),
  },
  async ({ table_name, column_name, schema_name, cascade }) => {
    if (READ_ONLY) return readOnlyToolError("drop_column");
    return jsonContent(
      await apiFetch(
        `/management/tables/${encodeURIComponent(table_name)}/columns/${encodeURIComponent(column_name)}`,
        {
          method: "DELETE",
          body: { schema_name, cascade },
        },
      ),
    );
  },
);

// ─── Tool: create_index ─────────────────────────────────────────────────────

server.tool(
  "create_index",
  "Create an index through Athena's management API. Blocked when read_only mode is enabled.",
  {
    table_name: z.string().describe("Target table name"),
    columns: z.array(z.string()).describe("Columns included in the index"),
    schema_name: z
      .string()
      .optional()
      .describe("Schema name (defaults to public)"),
    index_name: z.string().optional().describe("Optional explicit index name"),
    unique: z.boolean().optional().describe("Whether the index is unique"),
    method: z
      .string()
      .optional()
      .describe("Index access method (defaults to btree)"),
  },
  async ({ table_name, columns, schema_name, index_name, unique, method }) => {
    if (READ_ONLY) return readOnlyToolError("create_index");
    return jsonContent(
      await apiFetch("/management/indexes", {
        method: "POST",
        body: { table_name, columns, schema_name, index_name, unique, method },
      }),
    );
  },
);

// ─── Tool: drop_index ───────────────────────────────────────────────────────

server.tool(
  "drop_index",
  "Drop an index through Athena's management API. Blocked when read_only mode is enabled.",
  {
    index_name: z.string().describe("Index name to drop"),
    schema_name: z
      .string()
      .optional()
      .describe("Schema name (defaults to public)"),
  },
  async ({ index_name, schema_name }) => {
    if (READ_ONLY) return readOnlyToolError("drop_index");
    return jsonContent(
      await apiFetch(`/management/indexes/${encodeURIComponent(index_name)}`, {
        method: "DELETE",
        body: { schema_name },
      }),
    );
  },
);

// ─── Tool: run_pipeline ─────────────────────────────────────────────────────

server.tool(
  "run_pipeline",
  "Run a config-driven Athena pipeline (source -> transform -> sink).",
  {
    pipeline: z
      .string()
      .optional()
      .describe("Optional prebuilt pipeline name from Athena config"),
    source: pipelineSourceSchema.optional().describe("Pipeline source config"),
    transform: pipelineTransformSchema
      .optional()
      .describe("Pipeline transform config"),
    sink: pipelineSinkSchema.optional().describe("Pipeline sink config"),
  },
  async ({ pipeline, source, transform, sink }) =>
    jsonContent(
      await apiFetch("/pipelines", {
        method: "POST",
        body: { pipeline, source, transform, sink },
      }),
    ),
);

// ─── Tool: list_available_clients ──────────────────────────────────────────

server.tool(
  "list_available_clients",
  "List Athena/Postgres clients available to the current admin key.",
  {},
  async () => jsonContent(await apiFetch("/clients")),
);

// ─── Tool: list_api_keys ────────────────────────────────────────────────────

server.tool(
  "list_api_keys",
  "List Athena API keys using the admin API.",
  {},
  async () => jsonContent(await apiFetch("/admin/api-keys")),
);

// ─── Tool: create_api_key ───────────────────────────────────────────────────

server.tool(
  "create_api_key",
  "Create an Athena API key. Blocked when read_only mode is enabled.",
  createApiKeySchema.shape,
  async (input) => {
    if (READ_ONLY) return readOnlyToolError("create_api_key");
    return jsonContent(
      await apiFetch("/admin/api-keys", { method: "POST", body: input }),
    );
  },
);

// ─── Tool: update_api_key ───────────────────────────────────────────────────

server.tool(
  "update_api_key",
  "Update an existing Athena API key. Blocked when read_only mode is enabled.",
  updateApiKeySchema.shape,
  async ({ id, ...body }) => {
    if (READ_ONLY) return readOnlyToolError("update_api_key");
    return jsonContent(
      await apiFetch(`/admin/api-keys/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body,
      }),
    );
  },
);

// ─── Tool: delete_api_key ───────────────────────────────────────────────────

server.tool(
  "delete_api_key",
  "Delete an Athena API key. Blocked when read_only mode is enabled.",
  {
    id: z.string().describe("API key UUID"),
  },
  async ({ id }) => {
    if (READ_ONLY) return readOnlyToolError("delete_api_key");
    return jsonContent(
      await apiFetch(`/admin/api-keys/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    );
  },
);

// ─── Tool: list_api_key_rights ──────────────────────────────────────────────

server.tool(
  "list_api_key_rights",
  "List available Athena API key rights.",
  {},
  async () => jsonContent(await apiFetch("/admin/api-key-rights")),
);

// ─── Tool: create_api_key_right ─────────────────────────────────────────────

server.tool(
  "create_api_key_right",
  "Create an Athena API key right. Blocked when read_only mode is enabled.",
  apiKeyRightSchema.shape,
  async (input) => {
    if (READ_ONLY) return readOnlyToolError("create_api_key_right");
    return jsonContent(
      await apiFetch("/admin/api-key-rights", {
        method: "POST",
        body: input,
      }),
    );
  },
);

// ─── Tool: update_api_key_right ─────────────────────────────────────────────

server.tool(
  "update_api_key_right",
  "Update an Athena API key right. Blocked when read_only mode is enabled.",
  {
    id: z.string().describe("API key right UUID"),
    name: z.string().optional(),
    description: z.string().optional(),
  },
  async ({ id, ...body }) => {
    if (READ_ONLY) return readOnlyToolError("update_api_key_right");
    return jsonContent(
      await apiFetch(`/admin/api-key-rights/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body,
      }),
    );
  },
);

// ─── Tool: delete_api_key_right ─────────────────────────────────────────────

server.tool(
  "delete_api_key_right",
  "Delete an Athena API key right. Blocked when read_only mode is enabled.",
  {
    id: z.string().describe("API key right UUID"),
  },
  async ({ id }) => {
    if (READ_ONLY) return readOnlyToolError("delete_api_key_right");
    return jsonContent(
      await apiFetch(`/admin/api-key-rights/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    );
  },
);

// ─── Tool: get_api_key_config ───────────────────────────────────────────────

server.tool(
  "get_api_key_config",
  "Read the global Athena API key enforcement configuration.",
  {},
  async () => jsonContent(await apiFetch("/admin/api-key-config")),
);

// ─── Tool: update_api_key_config ────────────────────────────────────────────

server.tool(
  "update_api_key_config",
  "Update global Athena API key enforcement. Blocked when read_only mode is enabled.",
  {
    enforce_api_keys: z.boolean().describe("Whether API keys are globally enforced"),
  },
  async ({ enforce_api_keys }) => {
    if (READ_ONLY) return readOnlyToolError("update_api_key_config");
    return jsonContent(
      await apiFetch("/admin/api-key-config", {
        method: "PUT",
        body: { enforce_api_keys },
      }),
    );
  },
);

// ─── Tool: list_api_key_clients ─────────────────────────────────────────────

server.tool(
  "list_api_key_clients",
  "List per-client Athena API key enforcement overrides.",
  {},
  async () => jsonContent(await apiFetch("/admin/api-key-clients")),
);

// ─── Tool: save_api_key_client ──────────────────────────────────────────────

server.tool(
  "save_api_key_client",
  "Create or update a per-client Athena API key enforcement override. Blocked when read_only mode is enabled.",
  {
    client_name: z.string().describe("Athena client name"),
    enforce_api_keys: z.boolean().describe("Whether API keys are enforced for this client"),
  },
  async ({ client_name, enforce_api_keys }) => {
    if (READ_ONLY) return readOnlyToolError("save_api_key_client");
    return jsonContent(
      await apiFetch(
        `/admin/api-key-clients/${encodeURIComponent(client_name)}`,
        {
          method: "PUT",
          body: { enforce_api_keys },
        },
      ),
    );
  },
);

// ─── Tool: delete_api_key_client ────────────────────────────────────────────

server.tool(
  "delete_api_key_client",
  "Delete a per-client Athena API key enforcement override. Blocked when read_only mode is enabled.",
  {
    client_name: z.string().describe("Athena client name"),
  },
  async ({ client_name }) => {
    if (READ_ONLY) return readOnlyToolError("delete_api_key_client");
    return jsonContent(
      await apiFetch(
        `/admin/api-key-clients/${encodeURIComponent(client_name)}`,
        {
          method: "DELETE",
        },
      ),
    );
  },
);

// ─── Tool: list_athena_clients_admin ────────────────────────────────────────

server.tool(
  "list_athena_clients_admin",
  "List Athena clients from the database-backed admin catalog.",
  {},
  async () => jsonContent(await apiFetch("/admin/clients")),
);

// ─── Tool: create_athena_client ─────────────────────────────────────────────

server.tool(
  "create_athena_client",
  "Create an Athena client in the admin catalog. Blocked when read_only mode is enabled.",
  saveAthenaClientSchema.shape,
  async (input) => {
    if (READ_ONLY) return readOnlyToolError("create_athena_client");
    return jsonContent(
      await apiFetch("/admin/clients", { method: "POST", body: input }),
    );
  },
);

// ─── Tool: update_athena_client ─────────────────────────────────────────────

server.tool(
  "update_athena_client",
  "Update an Athena client in the admin catalog. Blocked when read_only mode is enabled.",
  saveAthenaClientSchema.shape,
  async ({ client_name, ...body }) => {
    if (READ_ONLY) return readOnlyToolError("update_athena_client");
    return jsonContent(
      await apiFetch(`/admin/clients/${encodeURIComponent(client_name)}`, {
        method: "PATCH",
        body: { client_name, ...body },
      }),
    );
  },
);

// ─── Tool: delete_athena_client ─────────────────────────────────────────────

server.tool(
  "delete_athena_client",
  "Soft-delete an Athena client from the admin catalog. Blocked when read_only mode is enabled.",
  {
    client_name: z.string().describe("Athena client name"),
  },
  async ({ client_name }) => {
    if (READ_ONLY) return readOnlyToolError("delete_athena_client");
    return jsonContent(
      await apiFetch(`/admin/clients/${encodeURIComponent(client_name)}`, {
        method: "DELETE",
      }),
    );
  },
);

// ─── Tool: freeze_athena_client ─────────────────────────────────────────────

server.tool(
  "freeze_athena_client",
  "Freeze or unfreeze an Athena client. Blocked when read_only mode is enabled.",
  {
    client_name: z.string().describe("Athena client name"),
    is_frozen: z.boolean().describe("Whether the client should be frozen"),
  },
  async ({ client_name, is_frozen }) => {
    if (READ_ONLY) return readOnlyToolError("freeze_athena_client");
    return jsonContent(
      await apiFetch(
        `/admin/clients/${encodeURIComponent(client_name)}/freeze`,
        {
          method: "PUT",
          body: { is_frozen },
        },
      ),
    );
  },
);

// ─── Tool: list_client_statistics ───────────────────────────────────────────

server.tool(
  "list_client_statistics",
  "List aggregated Athena client statistics from gateway logs.",
  {},
  async () => jsonContent(await apiFetch("/admin/clients/statistics")),
);

// ─── Tool: refresh_client_statistics ────────────────────────────────────────

server.tool(
  "refresh_client_statistics",
  "Rebuild Athena client statistics from gateway logs. Blocked when read_only mode is enabled.",
  {},
  async () => {
    if (READ_ONLY) return readOnlyToolError("refresh_client_statistics");
    return jsonContent(
      await apiFetch("/admin/clients/statistics/refresh", { method: "POST" }),
    );
  },
);

// ─── Tool: get_client_statistics ────────────────────────────────────────────

server.tool(
  "get_client_statistics",
  "Inspect per-client Athena statistics and touched tables.",
  {
    client_name: z.string().describe("Athena client name"),
  },
  async ({ client_name }) =>
    jsonContent(
      await apiFetch(
        `/admin/clients/${encodeURIComponent(client_name)}/statistics`,
      ),
    ),
);

// ─── Tool: toggle_supabase_ssl_enforcement ──────────────────────────────────

server.tool(
  "toggle_supabase_ssl_enforcement",
  "Enable or disable Supabase SSL enforcement for a project. Blocked when read_only mode is enabled.",
  {
    enabled: z
      .boolean()
      .describe("Whether Supabase SSL enforcement should be enabled"),
    access_token: z
      .string()
      .optional()
      .describe("Optional override for SUPABASE_ACCESS_TOKEN"),
    project_ref: z
      .string()
      .optional()
      .describe("Optional override for PROJECT_REF"),
  },
  async ({ enabled, access_token, project_ref }) => {
    if (READ_ONLY) return readOnlyToolError("toggle_supabase_ssl_enforcement");
    return jsonContent(
      await apiFetch("/api/v2/supabase/ssl_enforcement", {
        method: "POST",
        body: { enabled, access_token, project_ref },
      }),
    );
  },
);

// ─── Tool: list_router_registry ─────────────────────────────────────────────

server.tool(
  "list_router_registry",
  "List Athena router registry entries.",
  {},
  async () => jsonContent(await apiFetch("/router/registry")),
);

// ─── Tool: list_registry_entries ────────────────────────────────────────────

server.tool(
  "list_registry_entries",
  "List API registry entries from Athena.",
  {},
  async () => jsonContent(await apiFetch("/registry")),
);

// ─── Tool: get_registry_entry ───────────────────────────────────────────────

server.tool(
  "get_registry_entry",
  "Fetch a specific API registry entry by ID.",
  {
    api_registry_id: z.string().describe("Registry row identifier"),
  },
  async ({ api_registry_id }) =>
    jsonContent(
      await apiFetch(`/registry/${encodeURIComponent(api_registry_id)}`),
    ),
);

// ─── Tool: get_metrics ──────────────────────────────────────────────────────

server.tool(
  "get_metrics",
  "Fetch Athena's Prometheus metrics payload.",
  {},
  async () => {
    const data = await apiFetch("/metrics");
    return textContent(String(data));
  },
);

// ─── Tool: get_embedded_openapi ─────────────────────────────────────────────

server.tool(
  "get_embedded_openapi",
  "Download Athena's embedded OpenAPI YAML document.",
  {},
  async () => {
    const data = await apiFetch("/openapi.yaml");
    return textContent(String(data));
  },
);

// ─── Tool: get_websocket_info ───────────────────────────────────────────────

server.tool(
  "get_websocket_info",
  "Read Athena's websocket gateway contract metadata.",
  {},
  async () => jsonContent(await apiFetch("/wss/info")),
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
    process.stderr.write(
      `athena-mcp health server listening on port ${HEALTH_PORT}\n`,
    );
  });
}

async function main(): Promise<void> {
  startHealthServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `athena-mcp started (base_url=${BASE_URL}, client=${ATHENA_CLIENT}, read_only=${READ_ONLY}, version=${VERSION})\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
