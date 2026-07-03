---
title: MCP Tools Reference
description: Complete reference for every tool exposed by the Athena MCP server (@xylex-group/athena-mcp). Each tool is documented with description, inputs, read-only behavior, and backend mapping.
---

# Athena MCP Tools Reference

**Package:** `@xylex-group/athena-mcp`  
**Total Tools:** 169  
**Version:** See package.json (currently ~0.4.0)

## Important Notes

- Every tool supports an optional `client` parameter (only exposed when multiple clients are configured via `ATHENA_AVAILABLE_CLIENTS`).
- **Read-only mode** (`READ_ONLY=true`): All tools that modify data, create resources, or perform admin mutations are blocked and return an error. `execute_sql` and similar also reject write statements.
- Tools use the configured `ATHENA_BASE_URL`, API key, and client routing.
- For exact JSON schemas, see `mcp-tools.json` and `athena-mcp-openapi.yaml` in the package.
- Many tools are thin wrappers around Athena's HTTP API or the official SDK (`@xylex-group/athena`).

## Admin Client Catalog

### `list_athena_clients_admin`

Experimental admin tool. List Athena clients from the database-backed admin catalog.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/clients

---

### `create_athena_client`

Experimental admin tool. Create an Athena client in the admin catalog. Blocked when read_only mode is enabled.

**Input schema:** `SaveAthenaClientToolRequest`

Parameters:
- `client_name` (required): Athena client name
- `description`: string
- `pg_uri`: string
- `pg_uri_env_var`: string
- `is_active`: boolean
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/clients

---

### `update_athena_client`

Experimental admin tool. Update an Athena client in the admin catalog. Blocked when read_only mode is enabled.

**Input schema:** `SaveAthenaClientToolRequest`

Parameters:
- `client_name` (required): Athena client name
- `description`: string
- `pg_uri`: string
- `pg_uri_env_var`: string
- `is_active`: boolean
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/clients

---

### `delete_athena_client`

Experimental admin tool. Soft-delete an Athena client from the admin catalog. Blocked when read_only mode is enabled.

**Input schema:** `DeleteApiKeyClientToolRequest`

Parameters:
- `client_name` (required): Athena client name
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/clients

---

## API Keys & Rights

### `list_api_keys`

Experimental admin tool. List Athena API keys using the admin API.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/api-keys and rights

---

### `create_api_key`

Experimental admin tool. Create an Athena API key. Blocked when read_only mode is enabled.

**Input schema:** `CreateApiKeyToolRequest`

Parameters:
- `name` (required): Human-readable API key name
- `description`: Optional description
- `client_name`: Optional client binding for this key
- `expires_at`: Optional ISO date-time expiry
- `rights`: Rights to grant
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/api-keys and rights

---

### `update_api_key`

Experimental admin tool. Update an existing Athena API key. Blocked when read_only mode is enabled.

**Input schema:** `UpdateApiKeyToolRequest`

Parameters:
- `id` (required): API key UUID
- `name`: string
- `description`: string
- `client_name`: string
- `expires_at`: string
- `is_active`: boolean
- `rights`: array
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/api-keys and rights

---

### `delete_api_key`

Experimental admin tool. Delete an Athena API key. Blocked when read_only mode is enabled.

**Input schema:** `DeleteApiKeyToolRequest`

Parameters:
- `id` (required): API key UUID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/api-keys and rights

---

### `list_api_key_rights`

Experimental admin tool. List available Athena API key rights.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/api-keys and rights

---

### `create_api_key_right`

Experimental admin tool. Create an Athena API key right. Blocked when read_only mode is enabled.

**Input schema:** `ApiKeyRightToolRequest`

Parameters:
- `name` (required): Right name
- `description`: Optional description
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/api-keys and rights

---

### `update_api_key_right`

Experimental admin tool. Update an Athena API key right. Blocked when read_only mode is enabled.

**Input schema:** `UpdateApiKeyRightToolRequest`

Parameters:
- `id` (required): API key right UUID
- `name`: string
- `description`: string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/api-keys and rights

---

### `delete_api_key_right`

Experimental admin tool. Delete an Athena API key right. Blocked when read_only mode is enabled.

**Input schema:** `DeleteApiKeyToolRequest`

Parameters:
- `id` (required): API key UUID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/api-keys and rights

---

### `get_api_key_config`

Experimental admin tool. Read the global Athena API key enforcement configuration.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/api-keys and rights

---

### `update_api_key_config`

Experimental admin tool. Update global Athena API key enforcement. Blocked when read_only mode is enabled.

**Input schema:** `UpdateApiKeyConfigToolRequest`

Parameters:
- `enforce_api_keys` (required): Whether API keys are globally enforced
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/api-keys and rights

---

### `list_api_key_clients`

Experimental admin tool. List per-client Athena API key enforcement overrides.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/api-keys and rights

---

### `delete_api_key_client`

Experimental admin tool. Delete a per-client Athena API key enforcement override. Blocked when read_only mode is enabled.

**Input schema:** `DeleteApiKeyClientToolRequest`

Parameters:
- `client_name` (required): Athena client name
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/api-keys and rights

---

## Apply Tools

### `apply_migration`

Apply a SQL migration against the connected database. Blocked when read_only mode is enabled.

**Input schema:** `ApplyMigrationRequest`

Parameters:
- `sql` (required): SQL migration to execute
- `name`: Optional migration name or label
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---

## Auth SDK Tools

### `auth_get_session`

Get current session using the Athena auth SDK binding.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

### `auth_get_user`

Get current user using the Athena auth SDK binding.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

### `auth_sign_out`

Sign out the current session using the Athena auth SDK.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

### `auth_refresh_token`

Refresh access token using a refresh token via auth SDK.

**Input schema:** `RefreshTokenRequest`

Parameters:
- `refresh_token` (required): Refresh token
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

### `auth_sign_up`

Sign up a new user via Athena auth SDK. Blocked in read_only.

**Input schema:** `SignUpRequest`

Parameters:
- `email` (required): User email
- `password` (required): Password (min 8)
- `data`: Optional metadata
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

### `auth_sign_in`

Sign in with email/password via Athena auth SDK. Blocked in read_only.

**Input schema:** `SignInRequest`

Parameters:
- `email` (required): string
- `password` (required): string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

### `auth_forgot_password`

Trigger forgot password flow. Blocked in read_only.

**Input schema:** `ForgotPasswordRequest`

Parameters:
- `email` (required): string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

### `auth_reset_password`

Reset password with token. Blocked in read_only.

**Input schema:** `ResetPasswordRequest`

Parameters:
- `token` (required): string
- `new_password` (required): string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

### `auth_admin_list_users`

Admin list users via auth admin surface (may require elevated rights).

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

### `auth_admin_create_user`

Admin create user via auth. Blocked in read_only.

**Input schema:** `AdminCreateUserRequest`

Parameters:
- `email` (required): string
- `password`: string
- `email_confirm`: boolean
- `data`: object
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK auth module + /auth/*

---

## Chat SDK Tools

### `chat_list_rooms`

List chat rooms via Athena chat SDK module.

**Input schema:** `ListRoomsRequest`

Parameters:
- `limit`: integer
- `include_archived`: boolean
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK chat module + /chat/*

---

### `chat_create_room`

Create a chat room. Blocked in read_only.

**Input schema:** `ChatCreateRoomRequest`

Parameters:
- `slug` (required): string
- `name`: string
- `metadata`: object
- `is_private`: boolean
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK chat module + /chat/*

---

### `chat_get_room`

Get a specific chat room.

**Input schema:** `ChatRoomIdRequest`

Parameters:
- `room_id` (required): string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK chat module + /chat/*

---

### `chat_archive_room`

Archive a chat room. Blocked in read_only.

**Input schema:** `ChatRoomIdRequest`

Parameters:
- `room_id` (required): string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK chat module + /chat/*

---

### `chat_list_messages`

List messages for a room.

**Input schema:** `ListMessagesRequest`

Parameters:
- `room_id` (required): string
- `limit`: integer
- `before_id`: string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK chat module + /chat/*

---

### `chat_send_message`

Send a message. Blocked in read_only.

**Input schema:** `SendMessageRequest`

Parameters:
- `room_id` (required): string
- `content` (required): string
- `metadata`: object
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK chat module + /chat/*

---

### `chat_get_realtime_info`

Get chat realtime connection metadata via SDK.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK chat module + /chat/*

---

### `chat_search_messages`

Search chat messages.

**Input schema:** `ChatSearchRequest`

Parameters:
- `query` (required): string
- `room_id`: string
- `limit`: integer
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK chat module + /chat/*

---

## Data, Schema & Query Tools

### `list_tables`

List all tables available in the connected PostgreSQL database. Primary schema discovery tool.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /schema/*

---

### `list_extensions`

List all installed PostgreSQL extensions. May return empty if the gateway does not expose extension metadata.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `list_migrations`

List applied database migrations

**Input schema:** `ListMigrationsRequest`

Parameters:
- `table_name`: Migrations table name (defaults to 'schema_migrations')
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `get_logs`

Retrieve recent database or application logs

**Input schema:** `GetLogsRequest`

Parameters:
- `table_name`: Logs table name (defaults to 'logs')
- `limit`: Maximum number of log rows to return (defaults to 100)
- `level`: Filter by log level (e.g. 'error', 'warn', 'info')
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `get_columns_of_table`

Describe columns for a table using Athena's schema API

**Input schema:** `GetColumnsRequest`

Parameters:
- `table` (required): Table name (optionally schema-qualified) to describe
- `schema`: Optional schema name when the table name is not schema-qualified
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /schema/*

---

### `list_table_metadata`

Return the full metadata for a table: schema name, table name, and each column's name, type, default value, and nullable flag

**Input schema:** `ListTableMetadataRequest`

Parameters:
- `table` (required): Table name (optionally schema-qualified)
- `schema`: Optional schema name when the table name is not schema-qualified
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `list_schemas`

List database schemas visible to the current Athena client

**Input schema:** `ListSchemasRequest`

Parameters:
- `include_system`: Include pg_catalog and information_schema schemas
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /schema/*

---

### `list_views`

List visible views (and optionally materialized views). Uses Athena schema API.

**Input schema:** `ListViewsRequest`

Parameters:
- `schema`: Schema to limit the view lookup to
- `include_materialized`: Include materialized views (when supported by schema API)
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `list_foreign_keys`

List primary keys, foreign keys, and unique constraints for a table. Essential for understanding relationships and correct joins.

**Input schema:** `ListForeignKeysRequest`

Parameters:
- `table` (required): Table name (optionally schema-qualified)
- `schema`: Optional schema when table name is not schema-qualified
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `get_table_sample`

Sample rows from a table to understand its data shape. Quick alternative to writing SQL.

**Input schema:** `GetTableSampleRequest`

Parameters:
- `table` (required): Table name (optionally schema-qualified)
- `schema`: Optional schema when table name is not schema-qualified
- `limit`: Number of rows to sample (defaults to 10)
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `list_indexes`

List index definitions for a table. Helps with performance and query design.

**Input schema:** `ListIndexesRequest`

Parameters:
- `table` (required): Table name (optionally schema-qualified)
- `schema`: Optional schema when table name is not schema-qualified
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `get_row_by_id`

Fetch rows by primary key column value. Simplifies the common fetch-by-id use case.

**Input schema:** `GetRowByIdRequest`

Parameters:
- `table` (required): Table name (optionally schema-qualified)
- `id` (required): Primary key value (typically id)
- `id_column`: Primary key column name (defaults to 'id')
- `schema`: Optional schema when table name is not schema-qualified
- `limit`: Maximum rows to return (defaults to 100)
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `list_all_table_metadata`

Return metadata for all tables in one call: schema, name, columns, types, defaults, nullable. Uses Athena schema API.

**Input schema:** `ListAllTableMetadataRequest`

Parameters:
- `schema`: Optional schema to limit to (default: all user schemas)
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `delete_row`

Delete a row by primary key (resource_id). Blocked when read_only mode is enabled.

**Input schema:** `DeleteRowRequest`

Parameters:
- `table` (required): Table name (optionally schema-qualified)
- `resource_id` (required): Primary key value of the row to delete
- `schema`: Optional schema when table name is not schema-qualified
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---

### `update_row`

Update rows matching a condition. Blocked when read_only mode is enabled.

**Input schema:** `UpdateRowRequest`

Parameters:
- `table` (required): Table name (optionally schema-qualified)
- `set` (required): Column-value pairs to set
- `where_column` (required): Column to match in WHERE clause
- `where_value` (required): Value to match (converted to string)
- `schema`: Optional schema when table name is not schema-qualified
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---

### `get_row_by_eq_column_of_table`

Fetch rows from a table where `column = value` using Athena's fetch endpoint

**Input schema:** `GetRowByEqColumnRequest`

Parameters:
- `table` (required): Table name to query (optionally schema-qualified)
- `column` (required): Column name to match against
- `value` (required): Value to compare (converted to string for Athena)
- `schema`: Optional schema to override the table name
- `limit`: Maximum number of rows to return (defaults to 100)
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `get_api_root`

Fetch Athena API root metadata, including the advertised route list.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/api-keys and rights

---

### `get_cluster_health`

Check Athena mirror reachability, latency, throughput, and version metadata.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `create_table`

Create a managed table through Athena's management API. Blocked when read_only mode is enabled.

**Input schema:** `CreateTableToolRequest`

Parameters:
- `table_name` (required): Table name to create
- `schema_name`: Schema name (defaults to public)
- `columns`: Optional column definitions
- `if_not_exists`: Compatibility flag accepted by Athena
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---

### `create_index`

Create an index through Athena's management API. Blocked when read_only mode is enabled.

**Input schema:** `CreateIndexToolRequest`

Parameters:
- `table_name` (required): Target table name
- `columns` (required): Columns included in the index
- `schema_name`: Schema name (defaults to public)
- `index_name`: Optional explicit index name
- `unique`: Whether the index is unique
- `method`: Index access method (defaults to btree)
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---

### `list_available_clients`

List the MCP server's configured Athena client allowlist and, when available, the remote Athena client catalog response.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/clients

---

### `list_client_statistics`

Experimental admin tool. List aggregated Athena client statistics from gateway logs.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/clients

---

### `get_client_statistics`

Experimental admin tool. Inspect per-client Athena statistics and touched tables.

**Input schema:** `DeleteApiKeyClientToolRequest`

Parameters:
- `client_name` (required): Athena client name
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/clients

---

### `list_router_registry`

List Athena router registry entries.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `list_registry_entries`

List API registry entries from Athena.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `get_registry_entry`

Fetch a specific API registry entry by ID.

**Input schema:** `GetRegistryEntryToolRequest`

Parameters:
- `api_registry_id` (required): Registry row identifier
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `get_metrics`

Fetch Athena's Prometheus metrics payload.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `get_embedded_openapi`

Download Athena's embedded OpenAPI YAML document.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** /admin/api-keys and rights

---

### `get_websocket_info`

Read Athena's websocket gateway contract metadata.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

## Drop Tools

### `drop_table`

Drop a managed table through Athena's management API. Blocked when read_only mode is enabled.

**Input schema:** `DropTableToolRequest`

Parameters:
- `table_name` (required): Target table name
- `schema_name`: Schema name (defaults to public)
- `cascade`: Whether to cascade the drop
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---

### `drop_column`

Drop a managed table column through Athena's management API. Blocked when read_only mode is enabled.

**Input schema:** `DropColumnToolRequest`

Parameters:
- `table_name` (required): Target table name
- `column_name` (required): Column name to drop
- `schema_name`: Schema name (defaults to public)
- `cascade`: Whether to cascade the drop
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---

### `drop_index`

Drop an index through Athena's management API. Blocked when read_only mode is enabled.

**Input schema:** `DropIndexToolRequest`

Parameters:
- `index_name` (required): Index name to drop
- `schema_name`: Schema name (defaults to public)
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---

## Edit Tools

### `edit_table`

Apply safe additive ALTER TABLE operations through Athena's management API. Blocked when read_only mode is enabled.

**Input schema:** `EditTableToolRequest`

Parameters:
- `table_name` (required): Target table name
- `schema_name`: Schema name (defaults to public)
- `operations` (required): Ordered table alteration operations
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---

## Execute Tools

### `execute_sql`

Execute a raw SQL query. Write operations (and queries containing write keywords) are blocked when READ_ONLY mode is enabled. Supports optional driver selection.

**Input schema:** `ExecuteSqlRequest`

Parameters:
- `query` (required): Raw SQL query to execute
- `driver`: Driver to use (defaults to standard Athena query endpoint)
- `db_name`: Database name (used by /query/sql endpoint)
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /gateway/* or /query/*

---

## Freeze Tools

### `freeze_athena_client`

Experimental admin tool. Freeze or unfreeze an Athena client. Blocked when read_only mode is enabled.

**Input schema:** `FreezeAthenaClientToolRequest`

Parameters:
- `client_name` (required): Athena client name
- `is_frozen` (required): Whether the client should be frozen
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/clients

---

## Direct Gateway & Management Tools

### `get_management_capabilities`

List Athena management API capabilities and required rights for the current client.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `gateway_fetch`

Direct low-level gateway fetch operation.

**Input schema:** `GatewayFetchRequest`

Parameters:
- `table_name` (required): string
- `select`: string
- `where`: object
- `limit`: integer
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Direct /gateway/* or /management/*

---

### `gateway_insert`

Direct gateway insert. Blocked in read_only.

**Input schema:** `GatewayInsertRequest`

Parameters:
- `table_name` (required): string
- `insert_body` (required): 
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Direct /gateway/* or /management/*

---

### `gateway_rpc`

Direct /gateway/rpc/{fn} call.

**Input schema:** `GatewayRpcRequest`

Parameters:
- `function_name` (required): string
- `args`: object
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Direct /gateway/* or /management/*

---

### `gateway_sql`

Direct SQL execution via gateway sql surface (write guarded).

**Input schema:** `GatewaySqlRequest`

Parameters:
- `sql` (required): string
- `driver`: string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Direct /gateway/* or /management/*

---

### `list_views_management`

List views using management surface.

**Input schema:** `ListViewsMgmtRequest`

Parameters:
- `schema`: string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `list_management_functions`

List management functions surface.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

### `management_capabilities`

Management capabilities (alias).

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

## Insert Tools

### `insert_row`

Insert a row into a table. Blocked when read_only mode is enabled.

**Input schema:** `InsertRowRequest`

Parameters:
- `table` (required): Table name (optionally schema-qualified)
- `data` (required): Row data as key-value pairs
- `schema`: Optional schema when table name is not schema-qualified
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /gateway/* or /query/*

---

## Ping Tools

### `ping`

Run the Athena health check endpoint.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

## Refresh Tools

### `refresh_client_statistics`

Experimental admin tool. Rebuild Athena client statistics from gateway logs. Blocked when read_only mode is enabled.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/clients

---

## Run Tools

### `run_pipeline`

Run a config-driven Athena pipeline (source -> transform -> sink).

**Input schema:** `RunPipelineRequest`

Parameters:
- `pipeline`: Optional prebuilt pipeline name from Athena config
- `source`: Pipeline source config
- `transform`: Pipeline transform config
- `sink`: Pipeline sink config
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

## Save Tools

### `save_api_key_client`

Experimental admin tool. Create or update a per-client Athena API key enforcement override. Blocked when read_only mode is enabled.

**Input schema:** `SaveApiKeyClientToolRequest`

Parameters:
- `client_name` (required): Athena client name
- `enforce_api_keys` (required): Whether API keys are enforced for this client
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** /admin/api-keys and rights

---

## SDK DB & Core Tools

### `sdk_db_select`

Powerful select using the official SDK builder (db.from(table).select(...).eq(...).findMany()). Excellent for relations and typed queries.

**Input schema:** `SdkSelectRequest`

Parameters:
- `table` (required): string
- `select`: string
- `filters`: object
- `limit`: integer
- `offset`: integer
- `order`: string
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK (db, request)

---

### `sdk_db_insert`

SDK insert/upsert via db module. Blocked in read_only.

**Input schema:** `SdkInsertRequest`

Parameters:
- `table` (required): string
- `data` (required): 
- `upsert`: boolean
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK (db, request)

---

### `sdk_db_update`

SDK update via db.from().update(). Blocked in read_only.

**Input schema:** `SdkUpdateRequest`

Parameters:
- `table` (required): string
- `set` (required): object
- `filters` (required): object
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK (db, request)

---

### `sdk_db_delete`

SDK delete via db module. Blocked in read_only.

**Input schema:** `SdkDeleteRequest`

Parameters:
- `table` (required): string
- `filters` (required): object
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** @xylex-group/athena SDK (db, request)

---

### `sdk_db_rpc`

Call Postgres function/RPC via SDK db.rpc().

**Input schema:** `SdkRpcRequest`

Parameters:
- `function_name` (required): string
- `args`: object
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK (db, request)

---

### `sdk_db_query`

Raw query via SDK client.

**Input schema:** `SdkQueryRequest`

Parameters:
- `query` (required): string
- `params`: array
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK (db, request)

---

### `sdk_verify_connection`

Verify the SDK client connection.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** @xylex-group/athena SDK (db, request)

---

## Search Tools

### `search_columns`

Find tables and columns by name pattern. Speeds up schema discovery.

**Input schema:** `SearchColumnsRequest`

Parameters:
- `pattern` (required): Column or table name pattern (SQL LIKE, use % for wildcard)
- `schema`: Optional schema to limit search
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena HTTP API or SDK

---

## Storage Tools (Managed + Raw Object)

### `storage_credentials_list`

List managed Athena storage credentials using the storage SDK binding.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_catalog_list`

List managed Athena storage catalogs.

**Input schema:** `EmptyRequest`

Parameters:
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_catalog_create`

Create a managed Athena storage catalog.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_catalog_update`

Update a managed Athena storage catalog.

**Input schema:** `StorageCatalogUpdateRequest`

Parameters:
- `id` (required): Storage catalog ID
- `input` (required): UpdateStorageCatalogRequest payload
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_catalog_delete`

Delete a managed Athena storage catalog.

**Input schema:** `StorageCatalogIdRequest`

Parameters:
- `id` (required): Storage catalog ID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_upload`

Create an upload URL for a managed Athena storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_upload_many`

Create multiple upload URLs for managed Athena storage files in one call.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_confirm_upload`

Confirm that a managed Athena storage upload completed and persist any final metadata.

**Input schema:** `StorageFileOptionalInputRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `input`: Optional opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_upload_binary`

Upload small file content directly through MCP using either base64 or UTF-8 text.

**Input schema:** `StorageFileBinaryUploadRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `body_base64`: Base64-encoded file contents. Provide this or body_text.
- `body_text`: UTF-8 file contents. Provide this or body_base64.
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_list`

List managed Athena storage files.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_search`

Search managed Athena storage files.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_get`

Get managed Athena storage file metadata.

**Input schema:** `StorageFileIdRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_update`

Update managed Athena storage file metadata.

**Input schema:** `StorageFileUpdateRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `input` (required): UpdateStorageFileRequest payload
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_update_many`

Update many managed Athena storage files in one call.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_delete`

Delete a managed Athena storage file.

**Input schema:** `StorageFileIdRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_delete_many`

Delete many managed Athena storage files in one call.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_restore`

Restore a soft-deleted managed Athena storage file.

**Input schema:** `StorageFileIdRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_purge`

Purge a managed Athena storage file permanently.

**Input schema:** `StorageFileIdRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_copy`

Copy a managed Athena storage file.

**Input schema:** `StorageFileInputRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_url`

Generate a signed URL for a managed Athena storage file.

**Input schema:** `StorageFileUrlRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `query`: Optional GetStorageFileUrlQuery payload
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_public_url`

Generate the public URL for a managed Athena storage file.

**Input schema:** `StorageFileIdRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_proxy_url`

Generate the proxy URL for a managed Athena storage file.

**Input schema:** `StorageFileUrlRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `query`: Optional GetStorageFileUrlQuery payload
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_proxy`

Proxy a managed Athena storage file and return response metadata plus text when the proxied content is text-based.

**Input schema:** `StorageFileUrlRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `query`: Optional GetStorageFileUrlQuery payload
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_visibility_update`

PATCH-style visibility update for a managed Athena storage file.

**Input schema:** `StorageVisibilityRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `input` (required): SetStorageFileVisibilityRequest payload
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_visibility_set`

POST-style visibility update for a managed Athena storage file.

**Input schema:** `StorageVisibilityRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `input` (required): SetStorageFileVisibilityRequest payload
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_visibility_set_many`

Update visibility for many managed Athena storage files in one call.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_versions`

List managed Athena storage file versions.

**Input schema:** `StorageFileIdRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_version_restore`

Restore a specific managed Athena storage file version.

**Input schema:** `StorageFileVersionRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `version_id` (required): Managed storage file version ID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_version_delete`

Delete a specific managed Athena storage file version.

**Input schema:** `StorageFileVersionRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `version_id` (required): Managed storage file version ID
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_retention_get`

Read retention settings for a managed Athena storage file.

**Input schema:** `StorageFileRetentionGetRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `query`: Optional StorageFileRetentionRequest subset containing version_id
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_file_retention_set`

Set retention settings for a managed Athena storage file.

**Input schema:** `StorageFileInputRequest`

Parameters:
- `file_id` (required): Managed storage file ID
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_folder_list`

List managed Athena storage folders under a prefix.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_folder_tree`

Return the managed Athena storage folder tree under a prefix.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_folder_delete`

Delete a managed Athena storage folder.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_folder_move`

Move a managed Athena storage folder.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_permission_list`

List file-level permissions for a managed Athena storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_permission_grant`

Grant a permission for a managed Athena storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_permission_revoke`

Revoke a permission for a managed Athena storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_permission_check`

Check a permission for a managed Athena storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_list`

List raw S3-compatible objects through Athena storage.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_head`

Read object metadata with the raw S3-compatible storage binding.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_exists`

Check whether a raw storage object exists.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_validate`

Validate a raw storage object checksum or ETag.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_update`

Update object metadata or state with the raw storage binding.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_copy`

Copy a raw storage object.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_url`

Create a signed URL for a raw storage object.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_public_url`

Create a public URL for a raw storage object.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_delete`

Delete a raw storage object.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_upload_url`

Create an upload URL for a raw storage object.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_versions`

List versions for a raw storage object or prefix.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_version_restore`

Restore a specific raw storage object version.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_version_delete`

Delete a specific raw storage object version.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_post_policy`

Create a signed POST policy for a raw storage object upload.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_folder_create`

Create a folder in the raw S3-compatible object namespace.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_folder_delete`

Delete a folder in the raw S3-compatible object namespace.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_object_folder_rename`

Rename a folder in the raw S3-compatible object namespace.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_list`

List buckets visible to the Athena storage binding.

**Input schema:** `GenericOptionalStorageInputRequest`

Parameters:
- `input`: Optional opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_create`

Create a bucket through the Athena storage binding.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_delete`

Delete a bucket through the Athena storage binding.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_cors_get`

Read bucket CORS configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_cors_set`

Set bucket CORS configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_cors_delete`

Delete bucket CORS configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_lifecycle_get`

Read bucket lifecycle configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_lifecycle_set`

Set bucket lifecycle configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_lifecycle_delete`

Delete bucket lifecycle configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_policy_get`

Read bucket policy configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_policy_set`

Set bucket policy configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_policy_delete`

Delete bucket policy configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_public_access_get`

Read bucket public-access block configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_public_access_set`

Set bucket public-access block configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_bucket_public_access_delete`

Delete bucket public-access block configuration.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_multipart_create`

Create a multipart upload session for a managed storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_multipart_sign_part`

Sign a multipart upload part for a managed storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_multipart_complete`

Complete a multipart upload for a managed storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_multipart_abort`

Abort a multipart upload for a managed storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_multipart_list_parts`

List parts for a multipart upload on a managed storage file.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

### `storage_audit_list`

List storage audit events.

**Input schema:** `GenericStorageInputRequest`

Parameters:
- `input` (required): Opaque request payload forwarded to Athena storage
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** Yes

**Backend:** Athena Storage (SDK + /storage/*)

---

## Toggle Tools

### `toggle_supabase_ssl_enforcement`

Experimental admin tool. Enable or disable Supabase SSL enforcement for a project. Blocked when read_only mode is enabled.

**Input schema:** `ToggleSupabaseSslEnforcementToolRequest`

Parameters:
- `enabled` (required): Whether Supabase SSL enforcement should be enabled
- `access_token`: Optional override for SUPABASE_ACCESS_TOKEN
- `project_ref`: Optional override for PROJECT_REF
- `client`: Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.

**Read-only safe:** No (blocked in READ_ONLY mode)

**Backend:** Athena HTTP API or SDK

---


## Additional Resources

- Full machine-readable: `mcp-tools.json`, `athena-mcp-openapi.yaml`
- Source: https://github.com/xylex-group/athena-mcp
- Integrated in main Athena docs: see this page and related mcp-server docs.

*This reference can be regenerated from `scripts/generate-mcp-docs.js` using the current mcp-tools.json.*
