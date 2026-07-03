import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "../responses.js";
import type { AthenaRuntime } from "../runtime.js";
import { readOnlyToolError } from "../runtime.js";
import { registerTool } from "../tooling.js";

const tableNameSchema = { table: z.string().describe("Table name (optionally schema qualified)") };

const sdkSelectSchema = {
  table: z.string(),
  select: z.string().optional().describe("Columns or * or relation selects, e.g. id,name,profile(*)"),
  filters: z.record(z.string(), z.unknown()).optional().describe("Simple eq filters { col: value }"),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  order: z.string().optional().describe("Order clause e.g. created_at.desc"),
};

const sdkInsertSchema = {
  table: z.string(),
  data: z.union([
    z.record(z.string(), z.unknown()),
    z.array(z.record(z.string(), z.unknown())),
  ]).describe("Row or array of rows to insert"),
  upsert: z.boolean().optional(),
};

const sdkUpdateSchema = {
  table: z.string(),
  set: z.record(z.string(), z.unknown()),
  filters: z.record(z.string(), z.unknown()).describe("Filters for update e.g. { id: 123 }"),
};

const sdkDeleteSchema = {
  table: z.string(),
  filters: z.record(z.string(), z.unknown()),
};

const sdkRpcSchema = {
  function_name: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
};

/**
 * Tools that directly exercise the @xylex-group/athena SDK fluent + low-level surfaces
 * (db.from, rpc, query, verifyConnection, etc.).
 *
 * These give agents a "native SDK" experience rather than only raw HTTP paths.
 * They still go through the same client routing and read-only guardrails.
 */
export function registerSdkDbTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  registerTool(server, runtime, {
    description:
      "Perform a rich select using the Athena SDK builder API: client.db.from(table).select(...).eq(...).findMany(). " +
      "Excellent for relations (select: '*, profile(*)'), filters, ordering and pagination. " +
      "This is often preferable to raw SQL for discoverability.",
    name: "sdk_db_select",
    shape: sdkSelectSchema,
    handler: async ({ clientName, runtime }, input) => {
      try {
        const db = runtime.getDbModule(clientName);
        let builder = db.from(input.table);
        if (input.select) builder = builder.select(input.select);
        if (input.filters) {
          for (const [k, v] of Object.entries(input.filters)) {
            if (typeof (builder as any).eq === "function") builder = (builder as any).eq(k, v);
          }
        }
        if (input.order && (builder as any).order) builder = (builder as any).order(input.order);
        if (input.limit != null && (builder as any).limit) builder = (builder as any).limit(input.limit);
        if (input.offset != null && (builder as any).offset) builder = (builder as any).offset(input.offset);
        const res = await builder.findMany();
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Insert (or upsert) one or many rows using the official SDK insert/upsert builders. " +
      "Blocked in read-only mode. Returns the inserted rows (or count) on success.",
    name: "sdk_db_insert",
    shape: sdkInsertSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("sdk_db_insert");
      try {
        const db = runtime.getDbModule(clientName);
        const b = db.from(input.table);
        const res = input.upsert ? await b.upsert(input.data as any) : await b.insert(input.data as any);
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Update matching rows using the SDK update builder + filters. " +
      "Blocked when READ_ONLY=true.",
    name: "sdk_db_update",
    shape: sdkUpdateSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("sdk_db_update");
      try {
        const db = runtime.getDbModule(clientName);
        let b = db.from(input.table);
        for (const [k, v] of Object.entries(input.filters)) {
          if ((b as any).eq) b = (b as any).eq(k, v);
        }
        const res = await b.update(input.set as any);
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Delete rows matching filters using the SDK delete builder. " +
      "Blocked in read-only mode.",
    name: "sdk_db_delete",
    shape: sdkDeleteSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("sdk_db_delete");
      try {
        const db = runtime.getDbModule(clientName);
        let b = db.from(input.table);
        for (const [k, v] of Object.entries(input.filters)) {
          if ((b as any).eq) b = (b as any).eq(k, v);
        }
        const res = await b.delete();
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Call a Postgres stored procedure / RPC function using the SDK db.rpc(name, args). " +
      "Returns the function result set.",
    name: "sdk_db_rpc",
    shape: sdkRpcSchema,
    handler: async ({ clientName, runtime }, input) => {
      try {
        const db = runtime.getDbModule(clientName);
        const res = await db.rpc(input.function_name, input.args ?? {});
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Execute an arbitrary query string using the SDK's query surface (client.query or db.query). " +
      "Falls back to the gateway /query endpoint when necessary.",
    name: "sdk_db_query",
    shape: {
      query: z.string().describe("SQL query or gateway query object"),
      params: z.array(z.unknown()).optional().describe("Optional positional parameters"),
    },
    handler: async ({ clientName, runtime }, input) => {
      try {
        const client = runtime.getSdkClient(clientName) as any;
        const q = client.query || (await runtime.getDbModule(clientName)).query;
        const res = typeof q === "function" ? await q(input.query, input.params) : await runtime.apiFetch("/gateway/query", clientName, { method: "POST", body: { query: input.query } });
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Call the SDK's verifyConnection() helper. Returns connection health, version info, and latency when supported by the backend.",
    name: "sdk_verify_connection",
    handler: async ({ clientName, runtime }) => {
      try {
        const client = runtime.getSdkClient(clientName) as any;
        const res = typeof client.verifyConnection === "function"
          ? await client.verifyConnection()
          : await runtime.apiFetch("/ping", clientName);
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });
}
