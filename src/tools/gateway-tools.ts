import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "../responses.js";
import type { AthenaRuntime } from "../runtime.js";
import { readOnlyToolError } from "../runtime.js";
import { registerTool } from "../tooling.js";

const gatewayFetchSchema = {
  table_name: z.string(),
  select: z.string().optional(),
  where: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().optional(),
};

const gatewayInsertSchema = {
  table_name: z.string(),
  insert_body: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]),
};

const gatewayRpcSchema = {
  function_name: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
};

/**
 * Low-level direct exposure of Athena gateway + management routes as separate named tools.
 * Complements the higher-level data tools and the pure SDK tools.
 */
export function registerGatewayTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  registerTool(server, runtime, {
    description:
      "Low-level /gateway/fetch (or SDK equivalent). Use for precise control over fetch semantics. " +
      "For most cases prefer the higher level row tools or sdk_db_select.",
    name: "gateway_fetch",
    shape: gatewayFetchSchema,
    handler: async ({ clientName, runtime }, input) => {
      try {
        const client = runtime.getSdkClient(clientName) as any;
        if (client?.db?.from) {
          let b = client.db.from(input.table_name);
          if (input.select) b = b.select(input.select);
          if (input.where) Object.entries(input.where).forEach(([k, v]) => { if (b.eq) b = b.eq(k, v); });
          if (input.limit && b.limit) b = b.limit(input.limit);
          return jsonContent(await b.findMany());
        }
        return jsonContent(await runtime.apiFetch("/gateway/fetch", clientName, { method: "POST", body: input }));
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description: "Direct insert using the /gateway/insert contract (or SDK). Write-blocked in read-only mode.",
    name: "gateway_insert",
    shape: gatewayInsertSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("gateway_insert");
      try {
        const client = runtime.getSdkClient(clientName) as any;
        if (client?.db?.from) {
          return jsonContent(await client.db.from(input.table_name).insert(input.insert_body));
        }
        return jsonContent(await runtime.apiFetch("/gateway/insert", clientName, { method: "POST", body: input }));
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description: "Invoke a named RPC function via the canonical /gateway/rpc/{function_name} path.",
    name: "gateway_rpc",
    shape: gatewayRpcSchema,
    handler: async ({ clientName, runtime }, input) => {
      try {
        const path = `/gateway/rpc/${encodeURIComponent(input.function_name)}`;
        return jsonContent(await runtime.apiFetch(path, clientName, { method: "POST", body: { args: input.args ?? {} } }));
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Execute SQL directly against /gateway/sql (or /query/sql). " +
      "The driver parameter selects the execution backend when supported. " +
      "Write statements are rejected when the server is in read-only mode.",
    name: "gateway_sql",
    shape: {
      sql: z.string().describe("SQL statement to run"),
      driver: z.enum(["athena", "postgresql", "supabase"]).optional().describe("Execution driver"),
    },
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly && /insert|update|delete|drop|create|alter|truncate|grant|revoke/i.test(input.sql)) {
        return readOnlyToolError("gateway_sql");
      }
      try {
        return jsonContent(await runtime.apiFetch("/gateway/sql", clientName, { method: "POST", body: input }));
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description: "List database views using the management API surface (/management/views).",
    name: "list_views_management",
    shape: { schema: z.string().optional().describe("Optional schema filter") },
    handler: async ({ clientName, runtime }, input) => {
      try {
        const q = input.schema ? `?schema=${encodeURIComponent(input.schema)}` : "";
        return jsonContent(await runtime.apiFetch(`/management/views${q}`, clientName));
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description: "List functions exposed through the management API.",
    name: "list_management_functions",
    handler: async ({ clientName, runtime }) => {
      try {
        return jsonContent(await runtime.apiFetch("/management/functions", clientName));
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description: "Return management capabilities for the current client (rights required for various operations). Alias of get_management_capabilities.",
    name: "management_capabilities",
    handler: async ({ clientName, runtime }) => {
      try {
        return jsonContent(await runtime.apiFetch("/management/capabilities", clientName));
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });
}
