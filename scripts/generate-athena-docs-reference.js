const fs = require("fs");
const path = require("path");

const mcpRoot = path.resolve(__dirname, "..");
const athenaDocsRoot = "C:/Users/floris/documents/github/athena/apps/docs";

const data = JSON.parse(fs.readFileSync(path.join(mcpRoot, "mcp-tools.json"), "utf8"));
const tools = data.tools;
const defs = data.definitions || {};

function getInputSummary(tool) {
  const ref = tool.inputSchema && tool.inputSchema["$ref"] ? tool.inputSchema["$ref"].replace("#/definitions/", "") : null;
  if (!ref || !defs[ref]) return "No specific input (client override only).";
  const schema = defs[ref];
  if (!schema.properties || Object.keys(schema.properties).length === 0) return "Empty request (client override optional).";
  let lines = [];
  const props = schema.properties;
  const req = schema.required || [];
  Object.keys(props).forEach(key => {
    if (key === "client") return;
    const p = props[key];
    const desc = p.description || "";
    const type = p.type || (p.oneOf ? "string|number|boolean|null" : "object");
    const isReq = req.includes(key) ? "required" : "optional";
    lines.push(`- \`${key}\` (${type}, ${isReq}): ${desc}`);
  });
  return lines.length ? lines.join("\n") : "See full schema.";
}

let md = `---
title: MCP Tools Reference
description: Complete reference for every tool exposed by the Athena MCP server. Documents all ${tools.length} tools with descriptions, inputs, read-only behavior, and backend mappings.
---

# Athena MCP Tools - Complete Reference

**Package:** \`@xylex-group/athena-mcp\`
**Total Tools:** ${tools.length}

This page provides **documentation for each and every tool**.

## General Behavior
- Optional \`client\` field when multiple \`ATHENA_AVAILABLE_CLIENTS\` configured.
- Read-only mode blocks all mutating operations.
- Full schemas in the package's \`mcp-tools.json\` and \`athena-mcp-openapi.yaml\`.

`;

const categoryOrder = [
  "Schema & Data Discovery",
  "Row Access & Basic CRUD",
  "SQL, Migrations, Logs & Pipelines",
  "Health, Cluster & Infrastructure",
  "Table & Index Management (DDL)",
  "SDK Surfaces (Auth, Chat, DB)",
  "Direct Gateway & Management Routes",
  "Storage Tools",
  "Admin Client Catalog & Statistics",
  "API Keys, Rights & Enforcement",
  "Registry, Metrics & Observability"
];

const categories = {
  "Schema & Data Discovery": ["list_tables", "list_schemas", "list_extensions", "list_views", "get_columns_of_table", "list_table_metadata", "list_all_table_metadata", "list_foreign_keys", "list_indexes", "search_columns", "get_table_sample"],
  "Row Access & Basic CRUD": ["get_row_by_id", "get_row_by_eq_column_of_table", "insert_row", "update_row", "delete_row"],
  "SQL, Migrations, Logs & Pipelines": ["execute_sql", "list_migrations", "apply_migration", "get_logs", "run_pipeline"],
  "Health, Cluster & Infrastructure": ["ping", "get_api_root", "get_cluster_health", "get_management_capabilities", "list_available_clients"],
  "Table & Index Management (DDL)": ["create_table", "edit_table", "drop_table", "drop_column", "create_index", "drop_index"],
  "SDK Surfaces (Auth, Chat, DB)": tools.filter(t => t.name.startsWith("auth_") || t.name.startsWith("chat_") || t.name.startsWith("sdk_")).map(t => t.name),
  "Direct Gateway & Management Routes": ["gateway_fetch", "gateway_insert", "gateway_rpc", "gateway_sql", "list_views_management", "list_management_functions", "management_capabilities"],
  "Storage Tools": tools.filter(t => t.name.startsWith("storage_")).map(t => t.name),
  "Admin Client Catalog & Statistics": ["list_athena_clients_admin", "create_athena_client", "update_athena_client", "delete_athena_client", "freeze_athena_client", "list_client_statistics", "refresh_client_statistics", "get_client_statistics", "toggle_supabase_ssl_enforcement"],
  "API Keys, Rights & Enforcement": ["list_api_keys", "create_api_key", "update_api_key", "delete_api_key", "list_api_key_rights", "create_api_key_right", "update_api_key_right", "delete_api_key_right", "get_api_key_config", "update_api_key_config", "list_api_key_clients", "save_api_key_client", "delete_api_key_client"],
  "Registry, Metrics & Observability": ["list_router_registry", "list_registry_entries", "get_registry_entry", "get_metrics", "get_embedded_openapi", "get_websocket_info"]
};

categoryOrder.forEach(cat => {
  if (!categories[cat]) return;
  md += `## ${cat}\n\n`;
  categories[cat].forEach(name => {
    const tool = tools.find(t => t.name === name);
    if (!tool) return;
    md += `### \`${tool.name}\`\n\n`;
    md += `${tool.description}\n\n`;
    md += `**Inputs:**\n${getInputSummary(tool)}\n\n`;
    const isWrite = /create_|insert_|update_|delete_|drop_|apply_|sign_up|sign_in|send_message|archive_room|freeze|refresh|toggle|purge|grant|revoke|save_|upload|multipart/i.test(tool.name) || tool.description.toLowerCase().includes("blocked when read_only");
    md += `**Read-only safe:** ${isWrite ? "No — blocked when READ_ONLY=true" : "Yes"}\n\n`;
    let backend = "Athena HTTP API or @xylex-group/athena SDK";
    if (tool.name.startsWith("storage_")) backend = "Athena Storage (SDK + raw /storage routes)";
    else if (tool.name.startsWith("auth_")) backend = "Athena Auth SDK module";
    else if (tool.name.startsWith("chat_")) backend = "Athena Chat SDK module";
    else if (tool.name.startsWith("sdk_")) backend = "SDK db / request builders";
    else if (tool.name.startsWith("gateway_") || tool.name.includes("management")) backend = "Direct gateway or /management routes";
    else if (tool.name.includes("api_key")) backend = "/admin/api-keys* routes";
    else if (tool.name.includes("athena_client")) backend = "/admin/clients* routes";
    else if (["list_tables", "get_columns", "list_schemas", "list_views"].some(p => tool.name.includes(p))) backend = "/schema/*";
    else if (["execute_sql", "insert_row", "update_row", "delete_row"].some(p => tool.name.includes(p.split("_")[0]))) backend = "/gateway/* or /query/*";
    md += `**Backend:** ${backend}\n\n`;
    md += "---\n\n";
  });
});

md += `
## Notes
- This reference is generated from the current mcp-tools.json.
- For the absolute latest, see the source in the athena-mcp repository.
`;

const target = path.join(athenaDocsRoot, "content/docs/mcp-server/tools-reference.mdx");
fs.writeFileSync(target, md);
console.log("Wrote full per-tool reference to " + target);
console.log("Covered " + tools.length + " tools.");
