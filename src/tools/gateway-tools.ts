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

export function registerGatewayTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  // Direct gateway surfaces (separate tool calls)
  registerTool(server, runtime, {
    description: "Direct /gateway/fetch via SDK request surface or raw.",
    name: "gateway_fetch",
    shape: gatewayFetchSchema,
    handler: async ({ clientName, runtime }, input) => {
      const client = runtime.getSdkClient(clientName);
      // Prefer SDK if available, else fallback
      if ((client as any).db && typeof (client as any).db.from === "function") {
        let b = (client as any).db.from(input.table_name);
        if (input.select) b = b.select(input.select);
        if (input.where) {
          Object.entries(input.where).forEach(([k, v]) => { b = b.eq(k, v); });
        }
        if (input.limit) b = b.limit(input.limit);
        return jsonContent(await b.findMany());
      }
      return jsonContent(await runtime.apiFetch("/gateway/fetch", clientName, { method: "POST", body: input }));
    },
  });

  registerTool(server, runtime, {
    description: "Direct insert via /gateway/insert (or SDK). Blocked in read_only.",
    name: "gateway_insert",
    shape: gatewayInsertSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("gateway_insert");
      const client = runtime.getSdkClient(clientName);
      if ((client as any).db?.insert) {
        return jsonContent(await (client as any).db.from(input.table_name).insert(input.insert_body));
      }
      return jsonContent(await runtime.apiFetch("/gateway/insert", clientName, { method: "POST", body: input }));
    },
  });

  registerTool(server, runtime, {
    description: "Execute RPC via /gateway/rpc/{name}.",
    name: "gateway_rpc",
    shape: gatewayRpcSchema,
    handler: async ({ clientName, runtime }, input) => {
      const path = `/gateway/rpc/${encodeURIComponent(input.function_name)}`;
      return jsonContent(await runtime.apiFetch(path, clientName, { method: "POST", body: { args: input.args ?? {} } }));
    },
  });

  registerTool(server, runtime, {
    description: "Execute raw SQL via /gateway/sql or /query/sql (driver aware).",
    name: "gateway_sql",
    shape: {
      sql: z.string(),
      driver: z.enum(["athena", "postgresql", "supabase"]).optional(),
    },
    handler: async ({ clientName, runtime }, input) => {
      // may be write; caller + readOnly in execute_sql already guards higher, here forward
      if (runtime.config.readOnly && /insert|update|delete|drop|create|alter/i.test(input.sql)) {
        return readOnlyToolError("gateway_sql");
      }
      return jsonContent(await runtime.apiFetch("/gateway/sql", clientName, { method: "POST", body: input }));
    },
  });

  // Additional major management direct routes exposed as tools
  registerTool(server, runtime, {
    description: "List managed views (via management API).",
    name: "list_views_management",
    shape: { schema: z.string().optional() },
    handler: async ({ clientName, runtime }, input) => {
      const q = input.schema ? `?schema=${encodeURIComponent(input.schema)}` : "";
      return jsonContent(await runtime.apiFetch(`/management/views${q}`, clientName));
    },
  });

  registerTool(server, runtime, {
    description: "List provisioned functions or extensions surface (management).",
    name: "list_management_functions",
    handler: async ({ clientName, runtime }) => jsonContent(await runtime.apiFetch("/management/functions", clientName)),
  });

  registerTool(server, runtime, {
    description: "Get management capabilities (also exposed as get_management_capabilities).",
    name: "management_capabilities",
    handler: async ({ clientName, runtime }) => jsonContent(await runtime.apiFetch("/management/capabilities", clientName)),
  });
}
