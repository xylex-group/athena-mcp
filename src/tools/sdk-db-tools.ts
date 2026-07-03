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

export function registerSdkDbTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  registerTool(server, runtime, {
    description: "Use Athena SDK db.from(table).select(...).findMany() for typed-ish queries. Preferred for complex relations.",
    name: "sdk_db_select",
    shape: sdkSelectSchema,
    handler: async ({ clientName, runtime }, input) => {
      const db = runtime.getDbModule(clientName);
      let builder = db.from(input.table);
      if (input.select) builder = builder.select(input.select);
      if (input.filters) {
        for (const [k, v] of Object.entries(input.filters)) {
          builder = builder.eq(k, v as any);
        }
      }
      if (input.order) builder = builder.order(input.order);
      if (input.limit != null) builder = builder.limit(input.limit);
      if (input.offset != null) builder = builder.offset(input.offset);
      const res = await builder.findMany();
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Insert via SDK db.from().insert() or upsert. Blocked in read_only.",
    name: "sdk_db_insert",
    shape: sdkInsertSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("sdk_db_insert");
      const db = runtime.getDbModule(clientName);
      let b = db.from(input.table);
      const payload = input.data;
      const res = input.upsert ? await b.upsert(payload as any) : await b.insert(payload as any);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Update rows via SDK db. Blocked in read_only.",
    name: "sdk_db_update",
    shape: sdkUpdateSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("sdk_db_update");
      const db = runtime.getDbModule(clientName);
      let b = db.from(input.table);
      // apply filters
      for (const [k, v] of Object.entries(input.filters)) {
        b = b.eq(k, v as any);
      }
      const res = await b.update(input.set as any);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Delete rows via SDK db.from().delete(). Blocked in read_only.",
    name: "sdk_db_delete",
    shape: sdkDeleteSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("sdk_db_delete");
      const db = runtime.getDbModule(clientName);
      let b = db.from(input.table);
      for (const [k, v] of Object.entries(input.filters)) {
        b = b.eq(k, v as any);
      }
      const res = await b.delete();
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Call a Postgres RPC / stored function via the SDK db.rpc().",
    name: "sdk_db_rpc",
    shape: sdkRpcSchema,
    handler: async ({ clientName, runtime }, input) => {
      const db = runtime.getDbModule(clientName);
      const res = await db.rpc(input.function_name, input.args ?? {});
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Raw query via the SDK client.query (or db.query) for full control.",
    name: "sdk_db_query",
    shape: {
      query: z.string().describe("SQL or gateway query payload"),
      params: z.array(z.unknown()).optional(),
    },
    handler: async ({ clientName, runtime }, input) => {
      const db = runtime.getDbModule(clientName);
      const q = (db as any).query || (runtime.getSdkClient(clientName) as any).query;
      const res = typeof q === "function" ? await q(input.query, input.params) : await db.query(input.query);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Verify connection health using the full SDK client.verifyConnection().",
    name: "sdk_verify_connection",
    handler: async ({ clientName, runtime }) => {
      const client = runtime.getSdkClient(clientName) as any;
      const res = typeof client.verifyConnection === "function" ? await client.verifyConnection() : { ok: true, note: "verify not present, using sdk client" };
      return jsonContent(res);
    },
  });
}
