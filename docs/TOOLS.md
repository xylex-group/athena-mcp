# Athena MCP Tools Reference

**Version:** 0.4.0+  
**Package:** `@xylex-group/athena-mcp`  
**Backend:** Athena Gateway + `@xylex-group/athena` SDK (v2.12+)

This document provides **detailed documentation for every tool** exposed by the Athena MCP server.

Each tool:
- Is a first-class MCP tool (usable from Cursor, Claude, Continue, Windsurf, Zed, etc.)
- Accepts an optional `client` parameter when multiple `ATHENA_AVAILABLE_CLIENTS` are configured
- Respects the global `READ_ONLY` mode (write operations are rejected)
- Uses the same authentication + routing headers as the underlying Athena client (`X-Athena-Client`, `apikey`/`x-api-key`)

**Quick links:**
- [Schema & Data Tools](#schema--data-tools)
- [Health, Root & Cluster](#health--infrastructure-tools)
- [Table Management](#table-management-tools)
- [Migrations, Logs & Pipelines](#migrations--logs--pipelines)
- [SDK Surface (Auth, Chat, DB)](#sdk-surface-tools-auth-chat-db)
- [Direct Gateway & Management Routes](#direct-gateway--management-routes)
- [Admin API (Experimental)](#admin-api-tools)
- [API Keys & Rights](#api-keys--rights)
- [Registry, Metrics & Observability](#registry--metrics--observability)
- [Storage (Managed + Raw)](#storage-tools)
- [Configuration & Behavior Notes](#configuration--behavior-notes)

---

## Schema & Data Tools

### `list_tables`
List all tables visible to the current Athena client.

- **Input:** `EmptyRequest` (optional `client`)
- **Returns:** Array of table objects (usually `{ schema, name, ... }` or raw Athena response)
- **Backend:** `GET /schema/tables`
- **Read-only safe:** Yes

### `list_schemas`
List database schemas visible to the client.

- **Input:** `{ include_system?: boolean }`
- **Read-only safe:** Yes

### `list_extensions`
List installed PostgreSQL extensions.

Falls back gracefully when the gateway does not expose `pg_extension`.

### `list_views`
List regular + (optionally) materialized views.

**Input:**
- `schema` (optional)
- `include_materialized`

### `get_columns_of_table`
Describe columns for one table (name, type, nullable, default).

**Input:** `{ table: string, schema?: string }`

### `list_table_metadata`
Full column metadata for a single table (richer than `get_columns_of_table` in some deployments).

### `list_all_table_metadata`
Metadata for every table in one call (very useful for agents doing schema analysis).

### `list_foreign_keys`
Primary keys, foreign keys, and unique constraints for a table.

### `list_indexes`
Index definitions (name, method, columns, unique, etc.).

### `search_columns`
Search tables and columns by pattern (LIKE-style).

**Input:** `{ pattern: string, schema?: string }`

### `get_table_sample`
Return a small number of sample rows. Excellent for quickly understanding shape without writing queries.

**Input:** `{ table, schema?, limit? }` (default limit ~10)

### `get_row_by_id`
Fetch row(s) by primary key value (defaults to column `id`).

**Input:** `{ table, id, id_column?, schema?, limit? }`

### `get_row_by_eq_column_of_table`
Fetch rows where `column = value`.

### `insert_row` / `update_row` / `delete_row`
Classic row-level mutations. **Blocked in read-only mode.**

### `execute_sql`
Arbitrary SQL execution.

- Write statements are rejected when `READ_ONLY=true`
- Use `driver` to select `athena | postgresql | supabase` backend when supported.

### `get_logs`
Retrieve recent logs (usually from a `logs` table).

---

## Health & Infrastructure Tools

| Tool                        | Description                                      | Safe |
|-----------------------------|--------------------------------------------------|------|
| `ping`                      | Simple `/ping` liveness                          | Yes  |
| `get_api_root`              | Root metadata + advertised route list            | Yes  |
| `get_cluster_health`        | Mirror health, latency, throughput, versions     | Yes  |
| `get_management_capabilities` | Rights required for management operations      | Yes  |
| `list_available_clients`    | Show configured allowlist + remote client catalog| Yes  |

---

## Table Management Tools

All of these go through Athena's management API (`/management/...`) and are **blocked** when `READ_ONLY=true`.

- `create_table`
- `edit_table` (additive ALTERs only — safe operations)
- `drop_table`
- `drop_column`
- `create_index`
- `drop_index`

See schemas in `mcp-tools.json` or the OpenAPI for exact payload shapes.

---

## Migrations & Logs & Pipelines

- `list_migrations`
- `apply_migration` (blocked in read-only)
- `run_pipeline` (config-driven source→transform→sink)

---

## SDK Surface Tools (Auth, Chat, DB)

These tools were added in 0.4.0 to give agents **direct access to the official `@xylex-group/athena` SDK** rather than only raw HTTP.

### Auth Tools (`auth_*`)

| Tool                        | Description                                      | Write? | Notes |
|-----------------------------|--------------------------------------------------|--------|-------|
| `auth_get_session`          | Current session (user + tokens)                  | No     | Recommended for identity checks |
| `auth_get_user`             | Current user profile                             | No     |       |
| `auth_sign_in`              | Email + password login                           | Yes    | Blocked in read-only |
| `auth_sign_up`              | Create account                                   | Yes    |       |
| `auth_sign_out`             | Invalidate session                               | Yes    |       |
| `auth_refresh_token`        | Exchange refresh token                           | No     |       |
| `auth_forgot_password`      | Trigger reset email                              | Yes    |       |
| `auth_reset_password`       | Complete password reset                          | Yes    |       |
| `auth_admin_list_users`     | List users (admin)                               | No     | May need elevated key |
| `auth_admin_create_user`    | Create user bypassing signup (admin)             | Yes    | Elevated rights |

### Chat Tools (`chat_*`)

| Tool                        | Description                                      | Write? |
|-----------------------------|--------------------------------------------------|--------|
| `chat_list_rooms`           | List rooms                                       | No     |
| `chat_create_room`          | Create room                                      | Yes    |
| `chat_get_room`             | Get room + metadata                              | No     |
| `chat_archive_room`         | Archive room                                     | Yes    |
| `chat_list_messages`        | List messages (with pagination)                  | No     |
| `chat_send_message`         | Post message                                     | Yes    |
| `chat_search_messages`      | Full-text / metadata search                      | No     |
| `chat_get_realtime_info`    | WebSocket / realtime contract info               | No     |

### SDK DB Tools (`sdk_*`)

- `sdk_db_select` — Uses the fluent builder (`from().select().eq()...findMany()`). Best for relations.
- `sdk_db_insert` / `sdk_db_upsert`
- `sdk_db_update`
- `sdk_db_delete`
- `sdk_db_rpc` — Call stored functions
- `sdk_db_query` — Raw query via SDK
- `sdk_verify_connection`

These are the recommended path when you want the SDK to handle serialization, relations, etc.

---

## Direct Gateway & Management Routes

- `gateway_fetch`, `gateway_insert`, `gateway_rpc`, `gateway_sql`
- `list_views_management`
- `list_management_functions`
- `management_capabilities`

These exist so agents can hit the exact OpenAPI paths when the higher-level wrappers are insufficient.

---

## Admin API Tools

All admin tools are **only registered** when `ATHENA_ADMIN_EXPERIMENTAL_ENABLED=true`.

They include:
- API key CRUD + rights (`list_api_keys`, `create_api_key`, ...)
- Client catalog management (`list_athena_clients_admin`, `create_athena_client`, `freeze_athena_client`, ...)
- Statistics, API key config overrides, etc.

**Warning:** These are powerful and usually require a special static admin key.

---

## API Keys & Rights

Full surface for managing API keys and their rights (when admin mode enabled):
- `list_api_keys`, `create_api_key`, `update_api_key`, `delete_api_key`
- `list_api_key_rights`, `create_api_key_right`, ...
- Global + per-client enforcement config tools

---

## Registry & Metrics & Observability

- `list_router_registry`
- `list_registry_entries`
- `get_registry_entry`
- `get_metrics` (Prometheus)
- `get_embedded_openapi`
- `get_websocket_info`
- `toggle_supabase_ssl_enforcement` (write)

---

## Storage Tools

The storage surface is extremely comprehensive (managed catalog + raw S3-compatible object storage).

Major groups:

**Managed files & catalogs**
- `storage_credentials_list`
- `storage_catalog_*` (list/create/update/delete)
- `storage_file_*` (list, get, upload, uploadMany, update, delete, versions, retention, visibility, proxy, etc.)
- `storage_folder_*`
- `storage_permission_*`
- `storage_multipart_*`
- `storage_audit_list`

**Raw object / bucket surface**
- `storage_object_*` (list, head, update, delete, url, versions, folder, postPolicy, ...)
- `storage_bucket_*` (list, create, delete, cors, lifecycle, policy, publicAccess)

Almost all storage write operations are blocked in read-only mode.

See the full schemas in `mcp-tools.json` or `athena-mcp-openapi.yaml`.

---

## Configuration & Behavior Notes

### Client Routing
Every tool accepts an optional `client` string (only surfaced in the schema when >1 client is allowed).

### Read-Only Mode
When `READ_ONLY=true` (or `--read-only`):
- All `*insert*`, `*update*`, `*delete*`, `create_*`, `drop_*`, `apply_*`, `sign_up`, `send_message`, etc. return an error immediately.
- `execute_sql` / `gateway_sql` reject obvious write statements.

### Error Format
Most tools return either successful data or `{ error: "..." }` (wrapped by the MCP layer).

### Where to find exact schemas
- `mcp-tools.json` — canonical for MCP clients
- `athena-mcp-openapi.yaml` — OpenAPI 3 for other tooling / inspectors
- Source of truth: `scripts/generate-tool-artifacts.js`

---

## Contributing / Regenerating Docs

The authoritative list of tools lives in `scripts/generate-tool-artifacts.js`.

After changing tool registrations:

```bash
node scripts/generate-tool-artifacts.js
npm run build
npm test
```

The generator also feeds this `docs/TOOLS.md` (run the dedicated docs emitter or update manually when adding major categories).

---

**Last generated for version 0.4.0**

For the absolute latest machine-readable form, prefer `mcp-tools.json` and `athena-mcp-openapi.yaml`.
