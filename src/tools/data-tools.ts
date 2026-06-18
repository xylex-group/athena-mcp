import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sanitizeIdentifier } from "../identifier.js";
import { isWriteQuery } from "../query.js";
import { jsonContent, textContent } from "../responses.js";
import {
  editTableOperationSchema,
  managementColumnSchema,
  pipelineSinkSchema,
  pipelineSourceSchema,
  pipelineTransformSchema,
} from "../schemas.js";
import type { AthenaRuntime } from "../runtime.js";
import { readOnlyToolError } from "../runtime.js";
import { registerTool } from "../tooling.js";

interface TableRef {
  qualified: string;
  schema: string;
  table: string;
}

function queryResultToArray(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (Array.isArray(record.rows)) return record.rows;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.result)) return record.result;
  }
  return [];
}

function parseTableRef(table: string, defaultSchema?: string): TableRef {
  const schemaDefault = sanitizeIdentifier(defaultSchema ?? "public", "schema");
  if (table.includes(".")) {
    const [schemaPart, tablePart] = table.split(".", 2);
    const schemaName = sanitizeIdentifier(schemaPart.trim(), "schema");
    const tableName = sanitizeIdentifier(tablePart.trim(), "table");
    return {
      qualified: `${schemaName}.${tableName}`,
      schema: schemaName,
      table: tableName,
    };
  }

  const tableName = sanitizeIdentifier(table, "table");
  return {
    qualified:
      schemaDefault === "public" ? tableName : `${schemaDefault}.${tableName}`,
    schema: schemaDefault,
    table: tableName,
  };
}

async function getPrimaryKeyColumns(
  runtime: AthenaRuntime,
  clientName: string,
  schema: string,
  table: string,
): Promise<Set<string>> {
  try {
    const schemaLit = schema.replace(/'/g, "''");
    const tableLit = table.replace(/'/g, "''");
    const rows = queryResultToArray(
      await runtime.runQuery(
        `SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = '${schemaLit}' AND tc.table_name = '${tableLit}'`,
        clientName,
      ),
    ) as Array<{ column_name?: string }>;
    return new Set(rows.map((row) => (row.column_name ?? "").toLowerCase()));
  } catch {
    return new Set();
  }
}

function toSqlLiteral(val: string | number | boolean | null): string {
  if (val === null) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function registerDataTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  registerTool(server, runtime, {
    description: "List all tables available in the connected PostgreSQL database",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/schema/tables", clientName)),
    name: "list_tables",
  });

  registerTool(server, runtime, {
    description:
      "List all installed PostgreSQL extensions. May return empty if the gateway does not expose extension metadata.",
    handler: async ({ clientName, runtime }) => {
      try {
        const data = await runtime.runQuery(
          "SELECT extname AS name, extversion AS installed_version FROM pg_extension ORDER BY extname",
          clientName,
        );
        return jsonContent(data);
      } catch {
        return jsonContent({
          extensions: [],
          message: "Extension metadata not available via this client",
        });
      }
    },
    name: "list_extensions",
  });

  registerTool(server, runtime, {
    description: "List applied database migrations",
    name: "list_migrations",
    shape: {
      table_name: z
        .string()
        .optional()
        .describe("Migrations table name (defaults to 'schema_migrations')"),
    },
    handler: async ({ clientName, runtime }, { table_name }) => {
      const tableName = sanitizeIdentifier(
        table_name ?? "schema_migrations",
        "table_name",
      );
      return jsonContent(
        await runtime.runQuery(`SELECT * FROM ${tableName} ORDER BY 1`, clientName),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Apply a SQL migration against the connected database. Blocked when read_only mode is enabled.",
    name: "apply_migration",
    shape: {
      name: z
        .string()
        .optional()
        .describe("Optional migration name / label for reference"),
      sql: z.string().describe("The SQL migration to execute"),
    },
    handler: async ({ clientName, runtime }, { name, sql }) => {
      if (runtime.config.readOnly) return readOnlyToolError("apply_migration");
      const result = await runtime.runQuery(sql, clientName);
      return jsonContent({ migration: name ?? null, result });
    },
  });

  registerTool(server, runtime, {
    description: "Retrieve recent database or application logs",
    name: "get_logs",
    shape: {
      level: z
        .string()
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          "Level must contain only alphanumeric characters, underscores, or hyphens",
        )
        .optional()
        .describe("Filter by log level (e.g. 'error', 'warn', 'info')"),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of log rows to return (defaults to 100)"),
      table_name: z
        .string()
        .optional()
        .describe("Logs table name (defaults to 'logs')"),
    },
    handler: async ({ clientName, runtime }, { level, limit, table_name }) => {
      const tableName = sanitizeIdentifier(table_name ?? "logs", "table_name");
      const maxRows = limit ?? 100;
      const levelClause = level
        ? ` WHERE level = '${level.replace(/'/g, "''")}'`
        : "";
      const sql = `SELECT * FROM ${tableName}${levelClause} ORDER BY created_at DESC LIMIT ${maxRows}`;
      return jsonContent(await runtime.runQuery(sql, clientName));
    },
  });

  registerTool(server, runtime, {
    description: "Describe columns for a table using Athena's schema API",
    name: "get_columns_of_table",
    shape: {
      schema: z
        .string()
        .optional()
        .describe(
          "Optional schema name when the table name is not schema-qualified",
        ),
      table: z
        .string()
        .describe("Table name (optionally schema-qualified) to describe"),
    },
    handler: async ({ clientName, runtime }, { schema, table }) => {
      const ref = parseTableRef(table, schema);
      const primaryKeys = await getPrimaryKeyColumns(
        runtime,
        clientName,
        ref.schema,
        ref.table,
      );
      const data = (await runtime.apiFetch(
        `/schema/columns?table_name=${encodeURIComponent(ref.qualified)}`,
        clientName,
      )) as {
        columns?: Array<Record<string, unknown>>;
      };

      if (Array.isArray(data.columns) && data.columns.length > 0) {
        return jsonContent({
          columns: data.columns.map((column) => ({
            ...column,
            primary_key: primaryKeys.has(
              String(column.column_name ?? "").toLowerCase(),
            ),
          })),
        });
      }

      try {
        const schemaLit = ref.schema.replace(/'/g, "''");
        const tableLit = ref.table.replace(/'/g, "''");
        const rows = queryResultToArray(
          await runtime.runQuery(
            `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = '${schemaLit}' AND table_name = '${tableLit}' ORDER BY ordinal_position`,
            clientName,
          ),
        ) as Array<Record<string, unknown>>;
        return jsonContent({
          columns: rows.map((row) => ({
            column_default: row.column_default,
            column_name: row.column_name,
            data_type: row.data_type,
            is_nullable: row.is_nullable,
            primary_key: primaryKeys.has(
              String(row.column_name ?? "").toLowerCase(),
            ),
          })),
        });
      } catch {
        return jsonContent(data);
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Return the full metadata for a table: schema name, table name, and each column's name, type, default value, and nullable flag",
    name: "list_table_metadata",
    shape: {
      schema: z
        .string()
        .optional()
        .describe(
          "Optional schema name when the table name is not schema-qualified",
        ),
      table: z.string().describe("Table name (optionally schema-qualified)"),
    },
    handler: async ({ clientName, runtime }, { schema, table }) => {
      const ref = parseTableRef(table, schema);
      const primaryKeys = await getPrimaryKeyColumns(
        runtime,
        clientName,
        ref.schema,
        ref.table,
      );
      const raw = (await runtime.apiFetch(
        `/schema/columns?table_name=${encodeURIComponent(ref.qualified)}`,
        clientName,
      )) as {
        columns?: Array<{
          column_default?: string | null;
          column_name?: string;
          data_type?: string;
          is_nullable?: string | null;
        }>;
      };

      let columns = Array.isArray(raw.columns) ? raw.columns : [];
      if (columns.length === 0) {
        try {
          const schemaLit = ref.schema.replace(/'/g, "''");
          const tableLit = ref.table.replace(/'/g, "''");
          columns = queryResultToArray(
            await runtime.runQuery(
              `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = '${schemaLit}' AND table_name = '${tableLit}' ORDER BY ordinal_position`,
              clientName,
            ),
          ) as typeof columns;
        } catch {
          columns = [];
        }
      }

      return jsonContent({
        columns: columns.map((column) => ({
          default: column.column_default ?? null,
          name: column.column_name ?? "",
          nullable: (column.is_nullable ?? "YES").toUpperCase() === "YES",
          primary_key: primaryKeys.has((column.column_name ?? "").toLowerCase()),
          type: column.data_type ?? "unknown",
        })),
        qualified: ref.qualified,
        schema: ref.schema,
        table: ref.table,
      });
    },
  });

  registerTool(server, runtime, {
    description: "List database schemas visible to the current Athena client",
    name: "list_schemas",
    shape: {
      include_system: z
        .boolean()
        .optional()
        .describe(
          "Include system schemas such as pg_catalog and information_schema",
        ),
    },
    handler: async ({ clientName, runtime }, { include_system }) => {
      const data = (await runtime.apiFetch("/schema/tables", clientName)) as {
        tables?: Array<{ table_schema?: string }>;
      };
      const tables = Array.isArray(data.tables) ? data.tables : [];
      const schemas = [
        ...new Set(tables.map((table) => table.table_schema ?? "").filter(Boolean)),
      ].sort();
      const filtered = include_system
        ? schemas
        : schemas.filter(
            (schemaName) =>
              !schemaName.startsWith("pg_") &&
              schemaName !== "information_schema",
          );
      return jsonContent(filtered.map((schemaName) => ({ schema_name: schemaName })));
    },
  });

  registerTool(server, runtime, {
    description:
      "List visible views (and optionally materialized views). Uses Athena schema API.",
    name: "list_views",
    shape: {
      include_materialized: z
        .boolean()
        .optional()
        .describe("Include materialized views (when supported by schema API)"),
      schema: z.string().optional().describe("Schema to limit the view lookup to"),
    },
    handler: async ({ clientName, runtime }, { include_materialized, schema }) => {
      const data = (await runtime.apiFetch("/schema/tables", clientName)) as {
        tables?: Array<{
          table_name?: string;
          table_schema?: string;
          table_type?: string;
        }>;
      };
      const tables = Array.isArray(data.tables) ? data.tables : [];
      const result = tables
        .filter((table) => {
          if (schema && (table.table_schema ?? "") !== schema) return false;
          if (
            (table.table_schema ?? "").startsWith("pg_") ||
            table.table_schema === "information_schema"
          ) {
            return false;
          }

          const type = (table.table_type ?? "").toUpperCase();
          return (
            type === "VIEW" ||
            (include_materialized !== false && type === "MATERIALIZED VIEW")
          );
        })
        .map((table) => ({
          table_name: table.table_name,
          table_schema: table.table_schema,
        }))
        .sort((left, right) =>
          `${left.table_schema}.${left.table_name}`.localeCompare(
            `${right.table_schema}.${right.table_name}`,
          ),
        );
      return jsonContent(result);
    },
  });

  registerTool(server, runtime, {
    description:
      "List primary keys, foreign keys, and unique constraints for a table. Essential for understanding relationships and correct joins.",
    name: "list_foreign_keys",
    shape: {
      schema: z
        .string()
        .optional()
        .describe("Optional schema when table name is not schema-qualified"),
      table: z.string().describe("Table name (optionally schema-qualified)"),
    },
    handler: async ({ clientName, runtime }, { schema, table }) => {
      const ref = parseTableRef(table, schema);
      const schemaLit = ref.schema.replace(/'/g, "''");
      const tableLit = ref.table.replace(/'/g, "''");
      try {
        return jsonContent(
          await runtime.runQuery(
            `SELECT tc.constraint_type, tc.constraint_name, kcu.column_name, ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema WHERE tc.table_schema = '${schemaLit}' AND tc.table_name = '${tableLit}' AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE') ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position`,
            clientName,
          ),
        );
      } catch {
        return jsonContent({
          constraints: [],
          message: "Constraint metadata not available via this client",
        });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Sample rows from a table to understand its data shape. Quick alternative to writing SQL.",
    name: "get_table_sample",
    shape: {
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Number of rows to sample (defaults to 10)"),
      schema: z
        .string()
        .optional()
        .describe("Optional schema when table name is not schema-qualified"),
      table: z.string().describe("Table name (optionally schema-qualified)"),
    },
    handler: async ({ clientName, runtime }, { limit, schema, table }) => {
      const ref = parseTableRef(table, schema);
      return jsonContent(
        await runtime.runQuery(
          `SELECT * FROM ${ref.qualified} LIMIT ${limit ?? 10}`,
          clientName,
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "List index definitions for a table. Helps with performance and query design.",
    name: "list_indexes",
    shape: {
      schema: z
        .string()
        .optional()
        .describe("Optional schema when table name is not schema-qualified"),
      table: z.string().describe("Table name (optionally schema-qualified)"),
    },
    handler: async ({ clientName, runtime }, { schema, table }) => {
      const ref = parseTableRef(table, schema);
      const schemaLit = ref.schema.replace(/'/g, "''");
      const tableLit = ref.table.replace(/'/g, "''");
      try {
        const rows = queryResultToArray(
          await runtime.runQuery(
            `SELECT indexname AS index_name, indexdef AS index_def FROM pg_indexes WHERE schemaname = '${schemaLit}' AND tablename = '${tableLit}' ORDER BY indexname`,
            clientName,
          ),
        ) as Array<Record<string, unknown>>;
        return jsonContent(
          rows.map((row) => ({
            index_def: row.index_def,
            index_name: row.index_name,
          })),
        );
      } catch {
        return jsonContent({
          indexes: [],
          message: "Index metadata not available via this client",
        });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Find tables and columns by name pattern. Speeds up schema discovery.",
    name: "search_columns",
    shape: {
      pattern: z
        .string()
        .describe("Column or table name pattern (SQL LIKE, use % for wildcard)"),
      schema: z.string().optional().describe("Optional schema to limit search"),
    },
    handler: async ({ clientName, runtime }, { pattern, schema }) => {
      const patternLit = pattern.replace(/'/g, "''");
      const schemaCondition = schema
        ? `c.table_schema = '${sanitizeIdentifier(schema, "schema").replace(/'/g, "''")}'`
        : "c.table_schema NOT IN ('pg_catalog', 'information_schema')";

      try {
        return jsonContent(
          await runtime.runQuery(
            `SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable FROM information_schema.columns c WHERE (LOWER(c.column_name) LIKE LOWER('${patternLit}') OR LOWER(c.table_name) LIKE LOWER('${patternLit}')) AND ${schemaCondition} ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
            clientName,
          ),
        );
      } catch {
        return jsonContent({
          message:
            "Column search not available via this client; use list_tables and get_columns_of_table instead",
          results: [],
        });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Fetch rows by primary key column value. Simplifies the common fetch-by-id use case.",
    name: "get_row_by_id",
    shape: {
      id: z
        .union([z.string(), z.number()])
        .describe("Primary key value (typically id)"),
      id_column: z
        .string()
        .optional()
        .describe("Primary key column name (defaults to 'id')"),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum rows to return (defaults to 100)"),
      schema: z
        .string()
        .optional()
        .describe("Optional schema when table name is not schema-qualified"),
      table: z.string().describe("Table name (optionally schema-qualified)"),
    },
    handler: async ({ clientName, runtime }, { id, id_column, limit, schema, table }) => {
      const ref = parseTableRef(table, schema);
      return jsonContent(
        await runtime.apiFetch("/gateway/fetch", clientName, {
          body: {
            conditions: [
              {
                eq_column: sanitizeIdentifier(id_column ?? "id", "id_column"),
                eq_value: String(id),
              },
            ],
            limit: limit ?? 100,
            table_name: ref.qualified,
          },
          method: "POST",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Return metadata for all tables in one call: schema, name, columns, types, defaults, nullable. Uses Athena schema API.",
    name: "list_all_table_metadata",
    shape: {
      schema: z
        .string()
        .optional()
        .describe("Optional schema to limit to (default: all user schemas)"),
    },
    handler: async ({ clientName, runtime }, { schema }) => {
      const tablesData = (await runtime.apiFetch("/schema/tables", clientName)) as {
        tables?: Array<{ table_name?: string; table_schema?: string }>;
      };
      const tables = Array.isArray(tablesData.tables) ? tablesData.tables : [];
      const filtered = schema
        ? tables.filter((table) => table.table_schema === schema)
        : tables.filter(
            (table) =>
              !(table.table_schema ?? "").startsWith("pg_") &&
              table.table_schema !== "information_schema",
          );

      const metadata: Array<{
        columns: Array<{
          default: string | null;
          name: string;
          nullable: boolean;
          primary_key: boolean;
          type: string;
        }>;
        schema: string;
        table: string;
      }> = [];

      for (const table of filtered) {
        const schemaName = table.table_schema ?? "public";
        const tableName = table.table_name ?? "";
        const primaryKeys = await getPrimaryKeyColumns(
          runtime,
          clientName,
          schemaName,
          tableName,
        );
        const schemaLit = schemaName.replace(/'/g, "''");
        const tableLit = tableName.replace(/'/g, "''");

        let columns: Array<{
          column_default?: string | null;
          column_name?: string;
          data_type?: string;
          is_nullable?: string;
        }> = [];

        try {
          const columnData = (await runtime.apiFetch(
            `/schema/columns?table_name=${encodeURIComponent(tableName)}`,
            clientName,
          )) as { columns?: typeof columns };
          columns = Array.isArray(columnData.columns) ? columnData.columns : [];
        } catch {
          columns = [];
        }

        if (columns.length === 0) {
          try {
            columns = queryResultToArray(
              await runtime.runQuery(
                `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = '${schemaLit}' AND table_name = '${tableLit}' ORDER BY ordinal_position`,
                clientName,
              ),
            ) as typeof columns;
          } catch {
            columns = [];
          }
        }

        metadata.push({
          columns: columns.map((column) => ({
            default: column.column_default ?? null,
            name: column.column_name ?? "",
            nullable: (column.is_nullable ?? "YES").toUpperCase() === "YES",
            primary_key: primaryKeys.has((column.column_name ?? "").toLowerCase()),
            type: column.data_type ?? "unknown",
          })),
          schema: schemaName,
          table: tableName,
        });
      }

      metadata.sort((left, right) =>
        `${left.schema}.${left.table}`.localeCompare(
          `${right.schema}.${right.table}`,
        ),
      );
      return jsonContent(metadata);
    },
  });

  registerTool(server, runtime, {
    description:
      "Insert a row into a table. Blocked when read_only mode is enabled.",
    name: "insert_row",
    shape: {
      data: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .describe("Row data as key-value pairs"),
      schema: z
        .string()
        .optional()
        .describe("Optional schema when table name is not schema-qualified"),
      table: z.string().describe("Table name (optionally schema-qualified)"),
    },
    handler: async ({ clientName, runtime }, { data, schema, table }) => {
      if (runtime.config.readOnly) return readOnlyToolError("insert_row");
      const ref = parseTableRef(table, schema);
      const insertBody = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          sanitizeIdentifier(key, "column"),
          value,
        ]),
      );
      return jsonContent(
        await runtime.apiFetch("/gateway/insert", clientName, {
          body: { insert_body: insertBody, table_name: ref.qualified },
          method: "PUT",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Delete a row by primary key (resource_id). Blocked when read_only mode is enabled.",
    name: "delete_row",
    shape: {
      resource_id: z.string().describe("Primary key value of the row to delete"),
      schema: z
        .string()
        .optional()
        .describe("Optional schema when table name is not schema-qualified"),
      table: z.string().describe("Table name (optionally schema-qualified)"),
    },
    handler: async ({ clientName, runtime }, { resource_id, schema, table }) => {
      if (runtime.config.readOnly) return readOnlyToolError("delete_row");
      const ref = parseTableRef(table, schema);
      return jsonContent(
        await runtime.apiFetch("/gateway/delete", clientName, {
          body: { resource_id, table_name: ref.qualified },
          method: "DELETE",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Update rows matching a condition. Blocked when read_only mode is enabled.",
    name: "update_row",
    shape: {
      schema: z
        .string()
        .optional()
        .describe("Optional schema when table name is not schema-qualified"),
      set: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .describe("Column-value pairs to set"),
      table: z.string().describe("Table name (optionally schema-qualified)"),
      where_column: z.string().describe("Column to match in WHERE clause"),
      where_value: z
        .union([z.string(), z.number(), z.boolean()])
        .describe("Value to match (converted to string)"),
    },
    handler: async (
      { clientName, runtime },
      { schema, set, table, where_column, where_value },
    ) => {
      if (runtime.config.readOnly) return readOnlyToolError("update_row");
      const ref = parseTableRef(table, schema);
      const setParts = Object.entries(set).map(([column, value]) => {
        const columnName = sanitizeIdentifier(column, "column");
        return `${columnName} = ${toSqlLiteral(value)}`;
      });
      const sql = `UPDATE ${ref.qualified} SET ${setParts.join(", ")} WHERE ${sanitizeIdentifier(where_column, "where_column")} = ${toSqlLiteral(where_value)}`;
      return jsonContent({
        result: await runtime.runQuery(sql, clientName),
      });
    },
  });

  registerTool(server, runtime, {
    description:
      "Fetch rows from a table where `column = value` using Athena's fetch endpoint",
    name: "get_row_by_eq_column_of_table",
    shape: {
      column: z.string().describe("Column name to match against"),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of rows to return (defaults to 100)"),
      schema: z
        .string()
        .optional()
        .describe("Optional schema to override the table name"),
      table: z
        .string()
        .describe("Table name to query (optionally schema-qualified)"),
      value: z
        .union([z.string(), z.number(), z.boolean()])
        .describe("Value to compare (converted to string for Athena)"),
    },
    handler: async ({ clientName, runtime }, { column, limit, schema, table, value }) => {
      const ref = parseTableRef(table, schema);
      return jsonContent(
        await runtime.apiFetch("/gateway/fetch", clientName, {
          body: {
            conditions: [
              {
                eq_column: sanitizeIdentifier(column, "column"),
                eq_value: String(value),
              },
            ],
            limit: limit ?? 100,
            table_name: ref.qualified,
          },
          method: "POST",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Execute a raw SQL query against the connected database. Write operations are blocked when read_only mode is enabled.",
    name: "execute_sql",
    shape: {
      db_name: z
        .string()
        .optional()
        .describe("Database name (used by /query/sql endpoint)"),
      driver: z
        .enum(["athena", "postgresql", "supabase"])
        .optional()
        .describe("Driver to use (defaults to standard Athena query endpoint)"),
      query: z.string().describe("The SQL query to execute"),
    },
    handler: async ({ clientName, runtime }, { db_name, driver, query }) => {
      if (runtime.config.readOnly && isWriteQuery(query)) {
        return readOnlyToolError("execute_sql");
      }

      if (driver && db_name) {
        return jsonContent(
          await runtime.apiFetch("/query/sql", clientName, {
            body: {
              db_name,
              driver,
              query: query.trim().replace(/;\s*$/, ""),
            },
            method: "POST",
          }),
        );
      }

      return jsonContent(await runtime.runQuery(query, clientName));
    },
  });

  registerTool(server, runtime, {
    description:
      "Fetch Athena API root metadata, including the advertised route list.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/", clientName)),
    name: "get_api_root",
  });

  registerTool(server, runtime, {
    description: "Run the Athena health check endpoint.",
    handler: async ({ clientName, runtime }) =>
      textContent(String(await runtime.apiFetch("/ping", clientName))),
    name: "ping",
  });

  registerTool(server, runtime, {
    description:
      "Check Athena mirror reachability, latency, throughput, and version metadata.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/health/cluster", clientName)),
    name: "get_cluster_health",
  });

  registerTool(server, runtime, {
    description:
      "List Athena management API capabilities and required rights for the current client.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/management/capabilities", clientName)),
    name: "get_management_capabilities",
  });

  registerTool(server, runtime, {
    description:
      "Create a managed table through Athena's management API. Blocked when read_only mode is enabled.",
    name: "create_table",
    shape: {
      columns: z
        .array(managementColumnSchema)
        .optional()
        .describe("Optional column definitions"),
      if_not_exists: z
        .boolean()
        .optional()
        .describe("Compatibility flag accepted by Athena"),
      schema_name: z
        .string()
        .optional()
        .describe("Schema name (defaults to public)"),
      table_name: z.string().describe("Table name to create"),
    },
    handler: async (
      { clientName, runtime },
      { columns, if_not_exists, schema_name, table_name },
    ) => {
      if (runtime.config.readOnly) return readOnlyToolError("create_table");
      return jsonContent(
        await runtime.apiFetch("/management/tables", clientName, {
          body: { columns, if_not_exists, schema_name, table_name },
          method: "POST",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Apply safe additive ALTER TABLE operations through Athena's management API. Blocked when read_only mode is enabled.",
    name: "edit_table",
    shape: {
      operations: z
        .array(editTableOperationSchema)
        .describe("Ordered table alteration operations"),
      schema_name: z
        .string()
        .optional()
        .describe("Schema name (defaults to public)"),
      table_name: z.string().describe("Target table name"),
    },
    handler: async ({ clientName, runtime }, { operations, schema_name, table_name }) => {
      if (runtime.config.readOnly) return readOnlyToolError("edit_table");
      return jsonContent(
        await runtime.apiFetch(
          `/management/tables/${encodeURIComponent(table_name)}`,
          clientName,
          {
            body: { operations, schema_name },
            method: "PATCH",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Drop a managed table through Athena's management API. Blocked when read_only mode is enabled.",
    name: "drop_table",
    shape: {
      cascade: z.boolean().optional().describe("Whether to cascade the drop"),
      schema_name: z
        .string()
        .optional()
        .describe("Schema name (defaults to public)"),
      table_name: z.string().describe("Target table name"),
    },
    handler: async ({ clientName, runtime }, { cascade, schema_name, table_name }) => {
      if (runtime.config.readOnly) return readOnlyToolError("drop_table");
      return jsonContent(
        await runtime.apiFetch(
          `/management/tables/${encodeURIComponent(table_name)}`,
          clientName,
          {
            body: { cascade, schema_name },
            method: "DELETE",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Drop a managed table column through Athena's management API. Blocked when read_only mode is enabled.",
    name: "drop_column",
    shape: {
      cascade: z.boolean().optional().describe("Whether to cascade the drop"),
      column_name: z.string().describe("Column name to drop"),
      schema_name: z
        .string()
        .optional()
        .describe("Schema name (defaults to public)"),
      table_name: z.string().describe("Target table name"),
    },
    handler: async (
      { clientName, runtime },
      { cascade, column_name, schema_name, table_name },
    ) => {
      if (runtime.config.readOnly) return readOnlyToolError("drop_column");
      return jsonContent(
        await runtime.apiFetch(
          `/management/tables/${encodeURIComponent(table_name)}/columns/${encodeURIComponent(column_name)}`,
          clientName,
          {
            body: { cascade, schema_name },
            method: "DELETE",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Create an index through Athena's management API. Blocked when read_only mode is enabled.",
    name: "create_index",
    shape: {
      columns: z.array(z.string()).describe("Columns included in the index"),
      index_name: z.string().optional().describe("Optional explicit index name"),
      method: z
        .string()
        .optional()
        .describe("Index access method (defaults to btree)"),
      schema_name: z
        .string()
        .optional()
        .describe("Schema name (defaults to public)"),
      table_name: z.string().describe("Target table name"),
      unique: z.boolean().optional().describe("Whether the index is unique"),
    },
    handler: async (
      { clientName, runtime },
      { columns, index_name, method, schema_name, table_name, unique },
    ) => {
      if (runtime.config.readOnly) return readOnlyToolError("create_index");
      return jsonContent(
        await runtime.apiFetch("/management/indexes", clientName, {
          body: {
            columns,
            index_name,
            method,
            schema_name,
            table_name,
            unique,
          },
          method: "POST",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Drop an index through Athena's management API. Blocked when read_only mode is enabled.",
    name: "drop_index",
    shape: {
      index_name: z.string().describe("Index name to drop"),
      schema_name: z
        .string()
        .optional()
        .describe("Schema name (defaults to public)"),
    },
    handler: async ({ clientName, runtime }, { index_name, schema_name }) => {
      if (runtime.config.readOnly) return readOnlyToolError("drop_index");
      return jsonContent(
        await runtime.apiFetch(
          `/management/indexes/${encodeURIComponent(index_name)}`,
          clientName,
          {
            body: { schema_name },
            method: "DELETE",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description: "Run a config-driven Athena pipeline (source -> transform -> sink).",
    name: "run_pipeline",
    shape: {
      pipeline: z
        .string()
        .optional()
        .describe("Optional prebuilt pipeline name from Athena config"),
      sink: pipelineSinkSchema.optional().describe("Pipeline sink config"),
      source: pipelineSourceSchema.optional().describe("Pipeline source config"),
      transform: pipelineTransformSchema
        .optional()
        .describe("Pipeline transform config"),
    },
    handler: async ({ clientName, runtime }, { pipeline, sink, source, transform }) =>
      jsonContent(
        await runtime.apiFetch("/pipelines", clientName, {
          body: { pipeline, sink, source, transform },
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description:
      "List the Athena clients configured for this MCP server and, when available, the remote Athena client catalog response.",
    name: "list_available_clients",
    handler: async ({ clientName, runtime }) => {
      try {
        const remote = await runtime.apiFetch("/clients", clientName);
        return jsonContent({
          configured_clients: runtime.config.availableClients,
          default_client: runtime.config.defaultClient,
          remote_clients: remote,
        });
      } catch (error) {
        return jsonContent({
          configured_clients: runtime.config.availableClients,
          default_client: runtime.config.defaultClient,
          remote_error: String(error),
        });
      }
    },
  });

  registerTool(server, runtime, {
    description: "List Athena router registry entries.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/router/registry", clientName)),
    name: "list_router_registry",
  });

  registerTool(server, runtime, {
    description: "List API registry entries from Athena.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/registry", clientName)),
    name: "list_registry_entries",
  });

  registerTool(server, runtime, {
    description: "Fetch a specific API registry entry by ID.",
    name: "get_registry_entry",
    shape: {
      api_registry_id: z.string().describe("Registry row identifier"),
    },
    handler: async ({ clientName, runtime }, { api_registry_id }) =>
      jsonContent(
        await runtime.apiFetch(
          `/registry/${encodeURIComponent(api_registry_id)}`,
          clientName,
        ),
      ),
  });

  registerTool(server, runtime, {
    description: "Fetch Athena's Prometheus metrics payload.",
    handler: async ({ clientName, runtime }) =>
      textContent(String(await runtime.apiFetch("/metrics", clientName))),
    name: "get_metrics",
  });

  registerTool(server, runtime, {
    description: "Download Athena's embedded OpenAPI YAML document.",
    handler: async ({ clientName, runtime }) =>
      textContent(String(await runtime.apiFetch("/openapi.yaml", clientName))),
    name: "get_embedded_openapi",
  });

  registerTool(server, runtime, {
    description: "Read Athena's websocket gateway contract metadata.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/wss/info", clientName)),
    name: "get_websocket_info",
  });
}
