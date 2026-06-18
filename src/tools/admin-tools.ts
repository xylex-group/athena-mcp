import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "../responses.js";
import {
  apiKeyRightSchema,
  createApiKeySchema,
  saveAthenaClientSchema,
  updateApiKeySchema,
} from "../schemas.js";
import type { AthenaRuntime } from "../runtime.js";
import { readOnlyToolError } from "../runtime.js";
import { registerTool } from "../tooling.js";

export function registerAdminTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  if (!runtime.config.adminExperimentalEnabled) return;

  registerTool(server, runtime, {
    description: "List Athena API keys using the admin API.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/admin/api-keys", clientName)),
    name: "list_api_keys",
  });

  registerTool(server, runtime, {
    description:
      "Create an Athena API key. Blocked when read_only mode is enabled.",
    name: "create_api_key",
    shape: createApiKeySchema.shape,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("create_api_key");
      return jsonContent(
        await runtime.apiFetch("/admin/api-keys", clientName, {
          body: input,
          method: "POST",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Update an existing Athena API key. Blocked when read_only mode is enabled.",
    name: "update_api_key",
    shape: updateApiKeySchema.shape,
    handler: async ({ clientName, runtime }, { id, ...body }) => {
      if (runtime.config.readOnly) return readOnlyToolError("update_api_key");
      return jsonContent(
        await runtime.apiFetch(
          `/admin/api-keys/${encodeURIComponent(id)}`,
          clientName,
          {
            body,
            method: "PATCH",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Delete an Athena API key. Blocked when read_only mode is enabled.",
    name: "delete_api_key",
    shape: {
      id: z.string().describe("API key UUID"),
    },
    handler: async ({ clientName, runtime }, { id }) => {
      if (runtime.config.readOnly) return readOnlyToolError("delete_api_key");
      return jsonContent(
        await runtime.apiFetch(
          `/admin/api-keys/${encodeURIComponent(id)}`,
          clientName,
          {
            method: "DELETE",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description: "List available Athena API key rights.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/admin/api-key-rights", clientName)),
    name: "list_api_key_rights",
  });

  registerTool(server, runtime, {
    description:
      "Create an Athena API key right. Blocked when read_only mode is enabled.",
    name: "create_api_key_right",
    shape: apiKeyRightSchema.shape,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("create_api_key_right");
      return jsonContent(
        await runtime.apiFetch("/admin/api-key-rights", clientName, {
          body: input,
          method: "POST",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Update an Athena API key right. Blocked when read_only mode is enabled.",
    name: "update_api_key_right",
    shape: {
      description: z.string().optional(),
      id: z.string().describe("API key right UUID"),
      name: z.string().optional(),
    },
    handler: async ({ clientName, runtime }, { id, ...body }) => {
      if (runtime.config.readOnly) return readOnlyToolError("update_api_key_right");
      return jsonContent(
        await runtime.apiFetch(
          `/admin/api-key-rights/${encodeURIComponent(id)}`,
          clientName,
          {
            body,
            method: "PATCH",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Delete an Athena API key right. Blocked when read_only mode is enabled.",
    name: "delete_api_key_right",
    shape: {
      id: z.string().describe("API key right UUID"),
    },
    handler: async ({ clientName, runtime }, { id }) => {
      if (runtime.config.readOnly) return readOnlyToolError("delete_api_key_right");
      return jsonContent(
        await runtime.apiFetch(
          `/admin/api-key-rights/${encodeURIComponent(id)}`,
          clientName,
          {
            method: "DELETE",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description: "Read the global Athena API key enforcement configuration.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/admin/api-key-config", clientName)),
    name: "get_api_key_config",
  });

  registerTool(server, runtime, {
    description:
      "Update global Athena API key enforcement. Blocked when read_only mode is enabled.",
    name: "update_api_key_config",
    shape: {
      enforce_api_keys: z
        .boolean()
        .describe("Whether API keys are globally enforced"),
    },
    handler: async ({ clientName, runtime }, { enforce_api_keys }) => {
      if (runtime.config.readOnly) return readOnlyToolError("update_api_key_config");
      return jsonContent(
        await runtime.apiFetch("/admin/api-key-config", clientName, {
          body: { enforce_api_keys },
          method: "PUT",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description: "List per-client Athena API key enforcement overrides.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/admin/api-key-clients", clientName)),
    name: "list_api_key_clients",
  });

  registerTool(server, runtime, {
    description:
      "Create or update a per-client Athena API key enforcement override. Blocked when read_only mode is enabled.",
    name: "save_api_key_client",
    shape: {
      client_name: z.string().describe("Athena client name"),
      enforce_api_keys: z
        .boolean()
        .describe("Whether API keys are enforced for this client"),
    },
    handler: async ({ clientName, runtime }, { client_name, enforce_api_keys }) => {
      if (runtime.config.readOnly) return readOnlyToolError("save_api_key_client");
      return jsonContent(
        await runtime.apiFetch(
          `/admin/api-key-clients/${encodeURIComponent(client_name)}`,
          clientName,
          {
            body: { enforce_api_keys },
            method: "PUT",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Delete a per-client Athena API key enforcement override. Blocked when read_only mode is enabled.",
    name: "delete_api_key_client",
    shape: {
      client_name: z.string().describe("Athena client name"),
    },
    handler: async ({ clientName, runtime }, { client_name }) => {
      if (runtime.config.readOnly) return readOnlyToolError("delete_api_key_client");
      return jsonContent(
        await runtime.apiFetch(
          `/admin/api-key-clients/${encodeURIComponent(client_name)}`,
          clientName,
          {
            method: "DELETE",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description: "List Athena clients from the database-backed admin catalog.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await runtime.apiFetch("/admin/clients", clientName)),
    name: "list_athena_clients_admin",
  });

  registerTool(server, runtime, {
    description:
      "Create an Athena client in the admin catalog. Blocked when read_only mode is enabled.",
    name: "create_athena_client",
    shape: saveAthenaClientSchema.shape,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("create_athena_client");
      return jsonContent(
        await runtime.apiFetch("/admin/clients", clientName, {
          body: input,
          method: "POST",
        }),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Update an Athena client in the admin catalog. Blocked when read_only mode is enabled.",
    name: "update_athena_client",
    shape: saveAthenaClientSchema.shape,
    handler: async ({ clientName, runtime }, { client_name, ...body }) => {
      if (runtime.config.readOnly) return readOnlyToolError("update_athena_client");
      return jsonContent(
        await runtime.apiFetch(
          `/admin/clients/${encodeURIComponent(client_name)}`,
          clientName,
          {
            body: { client_name, ...body },
            method: "PATCH",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Soft-delete an Athena client from the admin catalog. Blocked when read_only mode is enabled.",
    name: "delete_athena_client",
    shape: {
      client_name: z.string().describe("Athena client name"),
    },
    handler: async ({ clientName, runtime }, { client_name }) => {
      if (runtime.config.readOnly) return readOnlyToolError("delete_athena_client");
      return jsonContent(
        await runtime.apiFetch(
          `/admin/clients/${encodeURIComponent(client_name)}`,
          clientName,
          {
            method: "DELETE",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "Freeze or unfreeze an Athena client. Blocked when read_only mode is enabled.",
    name: "freeze_athena_client",
    shape: {
      client_name: z.string().describe("Athena client name"),
      is_frozen: z.boolean().describe("Whether the client should be frozen"),
    },
    handler: async ({ clientName, runtime }, { client_name, is_frozen }) => {
      if (runtime.config.readOnly) return readOnlyToolError("freeze_athena_client");
      return jsonContent(
        await runtime.apiFetch(
          `/admin/clients/${encodeURIComponent(client_name)}/freeze`,
          clientName,
          {
            body: { is_frozen },
            method: "PUT",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description: "List aggregated Athena client statistics from gateway logs.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(
        await runtime.apiFetch("/admin/clients/statistics", clientName),
      ),
    name: "list_client_statistics",
  });

  registerTool(server, runtime, {
    description:
      "Rebuild Athena client statistics from gateway logs. Blocked when read_only mode is enabled.",
    name: "refresh_client_statistics",
    handler: async ({ clientName, runtime }) => {
      if (runtime.config.readOnly) return readOnlyToolError("refresh_client_statistics");
      return jsonContent(
        await runtime.apiFetch(
          "/admin/clients/statistics/refresh",
          clientName,
          {
            method: "POST",
          },
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description: "Inspect per-client Athena statistics and touched tables.",
    name: "get_client_statistics",
    shape: {
      client_name: z.string().describe("Athena client name"),
    },
    handler: async ({ clientName, runtime }, { client_name }) =>
      jsonContent(
        await runtime.apiFetch(
          `/admin/clients/${encodeURIComponent(client_name)}/statistics`,
          clientName,
        ),
      ),
  });

  registerTool(server, runtime, {
    description:
      "Enable or disable Supabase SSL enforcement for a project. Blocked when read_only mode is enabled.",
    name: "toggle_supabase_ssl_enforcement",
    shape: {
      access_token: z
        .string()
        .optional()
        .describe("Optional override for SUPABASE_ACCESS_TOKEN"),
      enabled: z
        .boolean()
        .describe("Whether Supabase SSL enforcement should be enabled"),
      project_ref: z
        .string()
        .optional()
        .describe("Optional override for PROJECT_REF"),
    },
    handler: async ({ clientName, runtime }, { access_token, enabled, project_ref }) => {
      if (runtime.config.readOnly) {
        return readOnlyToolError("toggle_supabase_ssl_enforcement");
      }
      return jsonContent(
        await runtime.apiFetch("/api/v2/supabase/ssl_enforcement", clientName, {
          body: { access_token, enabled, project_ref },
          method: "POST",
        }),
      );
    },
  });
}
