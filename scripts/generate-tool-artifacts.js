const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const clientProp = {
  type: "string",
  description:
    "Optional Athena client override. The server rejects values not present in ATHENA_AVAILABLE_CLIENTS and only exposes this field when multiple clients are configured.",
};

function withClient(schema) {
  const out = JSON.parse(JSON.stringify(schema));
  out.type = out.type || "object";
  out.properties = out.properties || {};
  out.required = out.required || [];
  out.properties.client = clientProp;
  return out;
}

const nullableScalar = {
  oneOf: [
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    { type: "null" },
  ],
};
const scalar = {
  oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
};
const opaqueObject = {
  type: "object",
  additionalProperties: true,
};
const stringArray = { type: "array", items: { type: "string" } };

const definitions = {
  EmptyRequest: withClient({
    type: "object",
    description: "Tool request with no required arguments.",
    properties: {},
    required: [],
  }),
  ListMigrationsRequest: withClient({
    type: "object",
    properties: {
      table_name: {
        type: "string",
        description: "Migrations table name (defaults to 'schema_migrations')",
      },
    },
    required: [],
  }),
  ApplyMigrationRequest: withClient({
    type: "object",
    properties: {
      sql: { type: "string", description: "SQL migration to execute" },
      name: { type: "string", description: "Optional migration name or label" },
    },
    required: ["sql"],
  }),
  ExecuteSqlRequest: withClient({
    type: "object",
    properties: {
      query: { type: "string", description: "Raw SQL query to execute" },
      driver: {
        type: "string",
        enum: ["athena", "postgresql", "supabase"],
        description:
          "Driver to use (defaults to standard Athena query endpoint)",
      },
      db_name: {
        type: "string",
        description: "Database name (used by /query/sql endpoint)",
      },
    },
    required: ["query"],
  }),
  GetLogsRequest: withClient({
    type: "object",
    properties: {
      table_name: {
        type: "string",
        description: "Logs table name (defaults to 'logs')",
      },
      limit: {
        type: "integer",
        minimum: 1,
        description: "Maximum number of log rows to return (defaults to 100)",
      },
      level: {
        type: "string",
        pattern: "^[a-zA-Z0-9_-]+$",
        description: "Filter by log level (e.g. 'error', 'warn', 'info')",
      },
    },
    required: [],
  }),
  GetColumnsRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name (optionally schema-qualified) to describe",
      },
      schema: {
        type: "string",
        description:
          "Optional schema name when the table name is not schema-qualified",
      },
    },
    required: ["table"],
  }),
  ListTableMetadataRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name (optionally schema-qualified)",
      },
      schema: {
        type: "string",
        description:
          "Optional schema name when the table name is not schema-qualified",
      },
    },
    required: ["table"],
  }),
  ListSchemasRequest: withClient({
    type: "object",
    properties: {
      include_system: {
        type: "boolean",
        description: "Include pg_catalog and information_schema schemas",
      },
    },
    required: [],
  }),
  ListViewsRequest: withClient({
    type: "object",
    properties: {
      schema: {
        type: "string",
        description: "Schema to limit the view lookup to",
      },
      include_materialized: {
        type: "boolean",
        description: "Include materialized views (when supported by schema API)",
      },
    },
    required: [],
  }),
  GetRowByEqColumnRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name to query (optionally schema-qualified)",
      },
      column: { type: "string", description: "Column name to match against" },
      value: {
        ...scalar,
        description: "Value to compare (converted to string for Athena)",
      },
      schema: {
        type: "string",
        description: "Optional schema to override the table name",
      },
      limit: {
        type: "integer",
        minimum: 1,
        description: "Maximum number of rows to return (defaults to 100)",
      },
    },
    required: ["table", "column", "value"],
  }),
  ListForeignKeysRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name (optionally schema-qualified)",
      },
      schema: {
        type: "string",
        description: "Optional schema when table name is not schema-qualified",
      },
    },
    required: ["table"],
  }),
  GetTableSampleRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name (optionally schema-qualified)",
      },
      schema: {
        type: "string",
        description: "Optional schema when table name is not schema-qualified",
      },
      limit: {
        type: "integer",
        minimum: 1,
        description: "Number of rows to sample (defaults to 10)",
      },
    },
    required: ["table"],
  }),
  ListIndexesRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name (optionally schema-qualified)",
      },
      schema: {
        type: "string",
        description: "Optional schema when table name is not schema-qualified",
      },
    },
    required: ["table"],
  }),
  SearchColumnsRequest: withClient({
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Column or table name pattern (SQL LIKE, use % for wildcard)",
      },
      schema: { type: "string", description: "Optional schema to limit search" },
    },
    required: ["pattern"],
  }),
  GetRowByIdRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name (optionally schema-qualified)",
      },
      id: {
        oneOf: [{ type: "string" }, { type: "number" }],
        description: "Primary key value (typically id)",
      },
      id_column: {
        type: "string",
        description: "Primary key column name (defaults to 'id')",
      },
      schema: {
        type: "string",
        description: "Optional schema when table name is not schema-qualified",
      },
      limit: {
        type: "integer",
        minimum: 1,
        description: "Maximum rows to return (defaults to 100)",
      },
    },
    required: ["table", "id"],
  }),
  ListAllTableMetadataRequest: withClient({
    type: "object",
    properties: {
      schema: {
        type: "string",
        description: "Optional schema to limit to (default: all user schemas)",
      },
    },
    required: [],
  }),
  InsertRowRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name (optionally schema-qualified)",
      },
      data: {
        type: "object",
        additionalProperties: nullableScalar,
        description: "Row data as key-value pairs",
      },
      schema: {
        type: "string",
        description: "Optional schema when table name is not schema-qualified",
      },
    },
    required: ["table", "data"],
  }),
  DeleteRowRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name (optionally schema-qualified)",
      },
      resource_id: {
        type: "string",
        description: "Primary key value of the row to delete",
      },
      schema: {
        type: "string",
        description: "Optional schema when table name is not schema-qualified",
      },
    },
    required: ["table", "resource_id"],
  }),
  UpdateRowRequest: withClient({
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name (optionally schema-qualified)",
      },
      set: {
        type: "object",
        additionalProperties: nullableScalar,
        description: "Column-value pairs to set",
      },
      where_column: {
        type: "string",
        description: "Column to match in WHERE clause",
      },
      where_value: {
        ...scalar,
        description: "Value to match (converted to string)",
      },
      schema: {
        type: "string",
        description: "Optional schema when table name is not schema-qualified",
      },
    },
    required: ["table", "set", "where_column", "where_value"],
  }),
  ManagementColumn: {
    type: "object",
    properties: {
      name: { type: "string", description: "Column name" },
      data_type: { type: "string", description: "PostgreSQL data type" },
      nullable: { type: "boolean", description: "Whether the column is nullable" },
      default_expression: {
        type: "string",
        description: "Optional SQL default expression",
      },
    },
    required: ["name", "data_type"],
  },
  CreateTableToolRequest: withClient({
    type: "object",
    properties: {
      table_name: { type: "string", description: "Table name to create" },
      schema_name: {
        type: "string",
        description: "Schema name (defaults to public)",
      },
      columns: {
        type: "array",
        description: "Optional column definitions",
        items: { $ref: "#/definitions/ManagementColumn" },
      },
      if_not_exists: {
        type: "boolean",
        description: "Compatibility flag accepted by Athena",
      },
    },
    required: ["table_name"],
  }),
  EditTableToolRequest: withClient({
    type: "object",
    properties: {
      table_name: { type: "string", description: "Target table name" },
      schema_name: {
        type: "string",
        description: "Schema name (defaults to public)",
      },
      operations: {
        type: "array",
        description: "Ordered table alteration operations",
        items: { type: "object", additionalProperties: true },
      },
    },
    required: ["table_name", "operations"],
  }),
  DropTableToolRequest: withClient({
    type: "object",
    properties: {
      table_name: { type: "string", description: "Target table name" },
      schema_name: {
        type: "string",
        description: "Schema name (defaults to public)",
      },
      cascade: { type: "boolean", description: "Whether to cascade the drop" },
    },
    required: ["table_name"],
  }),
  DropColumnToolRequest: withClient({
    type: "object",
    properties: {
      table_name: { type: "string", description: "Target table name" },
      column_name: { type: "string", description: "Column name to drop" },
      schema_name: {
        type: "string",
        description: "Schema name (defaults to public)",
      },
      cascade: { type: "boolean", description: "Whether to cascade the drop" },
    },
    required: ["table_name", "column_name"],
  }),
  CreateIndexToolRequest: withClient({
    type: "object",
    properties: {
      table_name: { type: "string", description: "Target table name" },
      columns: {
        ...stringArray,
        description: "Columns included in the index",
      },
      schema_name: {
        type: "string",
        description: "Schema name (defaults to public)",
      },
      index_name: {
        type: "string",
        description: "Optional explicit index name",
      },
      unique: { type: "boolean", description: "Whether the index is unique" },
      method: {
        type: "string",
        description: "Index access method (defaults to btree)",
      },
    },
    required: ["table_name", "columns"],
  }),
  DropIndexToolRequest: withClient({
    type: "object",
    properties: {
      index_name: { type: "string", description: "Index name to drop" },
      schema_name: {
        type: "string",
        description: "Schema name (defaults to public)",
      },
    },
    required: ["index_name"],
  }),
  RunPipelineRequest: withClient({
    type: "object",
    properties: {
      pipeline: {
        type: "string",
        description: "Optional prebuilt pipeline name from Athena config",
      },
      source: {
        type: "object",
        description: "Pipeline source config",
        additionalProperties: true,
      },
      transform: {
        type: "object",
        description: "Pipeline transform config",
        additionalProperties: true,
      },
      sink: {
        type: "object",
        description: "Pipeline sink config",
        additionalProperties: true,
      },
    },
    required: [],
  }),
  CreateApiKeyToolRequest: withClient({
    type: "object",
    properties: {
      name: { type: "string", description: "Human-readable API key name" },
      description: { type: "string", description: "Optional description" },
      client_name: {
        type: "string",
        description: "Optional client binding for this key",
      },
      expires_at: {
        type: "string",
        description: "Optional ISO date-time expiry",
      },
      rights: { ...stringArray, description: "Rights to grant" },
    },
    required: ["name"],
  }),
  UpdateApiKeyToolRequest: withClient({
    type: "object",
    properties: {
      id: { type: "string", description: "API key UUID" },
      name: { type: "string" },
      description: { type: "string" },
      client_name: { type: "string" },
      expires_at: { type: "string" },
      is_active: { type: "boolean" },
      rights: stringArray,
    },
    required: ["id"],
  }),
  DeleteApiKeyToolRequest: withClient({
    type: "object",
    properties: {
      id: { type: "string", description: "API key UUID" },
    },
    required: ["id"],
  }),
  ApiKeyRightToolRequest: withClient({
    type: "object",
    properties: {
      name: { type: "string", description: "Right name" },
      description: { type: "string", description: "Optional description" },
    },
    required: ["name"],
  }),
  UpdateApiKeyRightToolRequest: withClient({
    type: "object",
    properties: {
      id: { type: "string", description: "API key right UUID" },
      name: { type: "string" },
      description: { type: "string" },
    },
    required: ["id"],
  }),
  UpdateApiKeyConfigToolRequest: withClient({
    type: "object",
    properties: {
      enforce_api_keys: {
        type: "boolean",
        description: "Whether API keys are globally enforced",
      },
    },
    required: ["enforce_api_keys"],
  }),
  SaveApiKeyClientToolRequest: withClient({
    type: "object",
    properties: {
      client_name: { type: "string", description: "Athena client name" },
      enforce_api_keys: {
        type: "boolean",
        description: "Whether API keys are enforced for this client",
      },
    },
    required: ["client_name", "enforce_api_keys"],
  }),
  DeleteApiKeyClientToolRequest: withClient({
    type: "object",
    properties: {
      client_name: { type: "string", description: "Athena client name" },
    },
    required: ["client_name"],
  }),
  SaveAthenaClientToolRequest: withClient({
    type: "object",
    properties: {
      client_name: { type: "string", description: "Athena client name" },
      description: { type: "string" },
      pg_uri: { type: "string" },
      pg_uri_env_var: { type: "string" },
      is_active: { type: "boolean" },
    },
    required: ["client_name"],
  }),
  FreezeAthenaClientToolRequest: withClient({
    type: "object",
    properties: {
      client_name: { type: "string", description: "Athena client name" },
      is_frozen: {
        type: "boolean",
        description: "Whether the client should be frozen",
      },
    },
    required: ["client_name", "is_frozen"],
  }),
  GetRegistryEntryToolRequest: withClient({
    type: "object",
    properties: {
      api_registry_id: {
        type: "string",
        description: "Registry row identifier",
      },
    },
    required: ["api_registry_id"],
  }),
  ToggleSupabaseSslEnforcementToolRequest: withClient({
    type: "object",
    properties: {
      enabled: {
        type: "boolean",
        description: "Whether Supabase SSL enforcement should be enabled",
      },
      access_token: {
        type: "string",
        description: "Optional override for SUPABASE_ACCESS_TOKEN",
      },
      project_ref: {
        type: "string",
        description: "Optional override for PROJECT_REF",
      },
    },
    required: ["enabled"],
  }),
  StorageCatalogIdRequest: withClient({
    type: "object",
    properties: {
      id: { type: "string", description: "Storage catalog ID" },
    },
    required: ["id"],
  }),
  StorageFileIdRequest: withClient({
    type: "object",
    properties: {
      file_id: { type: "string", description: "Managed storage file ID" },
    },
    required: ["file_id"],
  }),
  StorageFileUrlRequest: withClient({
    type: "object",
    properties: {
      file_id: { type: "string", description: "Managed storage file ID" },
      query: {
        ...opaqueObject,
        description: "Optional GetStorageFileUrlQuery payload",
      },
    },
    required: ["file_id"],
  }),
  StorageVisibilityRequest: withClient({
    type: "object",
    properties: {
      file_id: { type: "string", description: "Managed storage file ID" },
      input: {
        ...opaqueObject,
        description: "SetStorageFileVisibilityRequest payload",
      },
    },
    required: ["file_id", "input"],
  }),
  GenericStorageInputRequest: withClient({
    type: "object",
    properties: {
      input: {
        ...opaqueObject,
        description: "Opaque request payload forwarded to Athena storage",
      },
    },
    required: ["input"],
  }),
  GenericOptionalStorageInputRequest: withClient({
    type: "object",
    properties: {
      input: {
        ...opaqueObject,
        description: "Optional opaque request payload forwarded to Athena storage",
      },
    },
    required: [],
  }),
  StorageCatalogUpdateRequest: withClient({
    type: "object",
    properties: {
      id: { type: "string", description: "Storage catalog ID" },
      input: {
        ...opaqueObject,
        description: "UpdateStorageCatalogRequest payload",
      },
    },
    required: ["id", "input"],
  }),
  StorageFileUpdateRequest: withClient({
    type: "object",
    properties: {
      file_id: { type: "string", description: "Managed storage file ID" },
      input: {
        ...opaqueObject,
        description: "UpdateStorageFileRequest payload",
      },
    },
    required: ["file_id", "input"],
  }),
  ToolResult: {
    type: "object",
    properties: {
      content: {
        type: "array",
        description: "Content messages emitted by the tool (text/images/resources)",
        items: { $ref: "#/definitions/ToolContent" },
      },
      isError: {
        type: "boolean",
        description: "True when the tool execution failed",
      },
    },
  },
  ToolContent: {
    type: "object",
    properties: {
      type: {
        type: "string",
        description: "Content type (e.g. text, image, resource)",
      },
      text: {
        type: "string",
        description: "Textual result (available when type is text)",
      },
    },
  },
};

const tools = [
  ["list_tables", "List all tables available in the connected PostgreSQL database", "EmptyRequest"],
  ["list_extensions", "List all installed PostgreSQL extensions. May return empty if the gateway does not expose extension metadata.", "EmptyRequest"],
  ["list_migrations", "List applied database migrations", "ListMigrationsRequest"],
  ["apply_migration", "Apply a SQL migration against the connected database. Blocked when read_only mode is enabled.", "ApplyMigrationRequest"],
  ["execute_sql", "Execute a raw SQL query against the connected database. Write operations are blocked when read_only mode is enabled.", "ExecuteSqlRequest"],
  ["get_logs", "Retrieve recent database or application logs", "GetLogsRequest"],
  ["get_columns_of_table", "Describe columns for a table using Athena's schema API", "GetColumnsRequest"],
  ["list_table_metadata", "Return the full metadata for a table: schema name, table name, and each column's name, type, default value, and nullable flag", "ListTableMetadataRequest"],
  ["list_schemas", "List database schemas visible to the current Athena client", "ListSchemasRequest"],
  ["list_views", "List visible views (and optionally materialized views). Uses Athena schema API.", "ListViewsRequest"],
  ["list_foreign_keys", "List primary keys, foreign keys, and unique constraints for a table. Essential for understanding relationships and correct joins.", "ListForeignKeysRequest"],
  ["get_table_sample", "Sample rows from a table to understand its data shape. Quick alternative to writing SQL.", "GetTableSampleRequest"],
  ["list_indexes", "List index definitions for a table. Helps with performance and query design.", "ListIndexesRequest"],
  ["search_columns", "Find tables and columns by name pattern. Speeds up schema discovery.", "SearchColumnsRequest"],
  ["get_row_by_id", "Fetch rows by primary key column value. Simplifies the common fetch-by-id use case.", "GetRowByIdRequest"],
  ["list_all_table_metadata", "Return metadata for all tables in one call: schema, name, columns, types, defaults, nullable. Uses Athena schema API.", "ListAllTableMetadataRequest"],
  ["insert_row", "Insert a row into a table. Blocked when read_only mode is enabled.", "InsertRowRequest"],
  ["delete_row", "Delete a row by primary key (resource_id). Blocked when read_only mode is enabled.", "DeleteRowRequest"],
  ["update_row", "Update rows matching a condition. Blocked when read_only mode is enabled.", "UpdateRowRequest"],
  ["get_row_by_eq_column_of_table", "Fetch rows from a table where `column = value` using Athena's fetch endpoint", "GetRowByEqColumnRequest"],
  ["get_api_root", "Fetch Athena API root metadata, including the advertised route list.", "EmptyRequest"],
  ["ping", "Run the Athena health check endpoint.", "EmptyRequest"],
  ["get_cluster_health", "Check Athena mirror reachability, latency, throughput, and version metadata.", "EmptyRequest"],
  ["get_management_capabilities", "List Athena management API capabilities and required rights for the current client.", "EmptyRequest"],
  ["create_table", "Create a managed table through Athena's management API. Blocked when read_only mode is enabled.", "CreateTableToolRequest"],
  ["edit_table", "Apply safe additive ALTER TABLE operations through Athena's management API. Blocked when read_only mode is enabled.", "EditTableToolRequest"],
  ["drop_table", "Drop a managed table through Athena's management API. Blocked when read_only mode is enabled.", "DropTableToolRequest"],
  ["drop_column", "Drop a managed table column through Athena's management API. Blocked when read_only mode is enabled.", "DropColumnToolRequest"],
  ["create_index", "Create an index through Athena's management API. Blocked when read_only mode is enabled.", "CreateIndexToolRequest"],
  ["drop_index", "Drop an index through Athena's management API. Blocked when read_only mode is enabled.", "DropIndexToolRequest"],
  ["run_pipeline", "Run a config-driven Athena pipeline (source -> transform -> sink).", "RunPipelineRequest"],
  ["list_available_clients", "List the MCP server's configured Athena client allowlist and, when available, the remote Athena client catalog response.", "EmptyRequest"],
  ["storage_credentials_list", "List managed Athena storage credentials using the storage SDK binding.", "EmptyRequest"],
  ["storage_catalog_list", "List managed Athena storage catalogs.", "EmptyRequest"],
  ["storage_catalog_create", "Create a managed Athena storage catalog.", "GenericStorageInputRequest"],
  ["storage_catalog_update", "Update a managed Athena storage catalog.", "StorageCatalogUpdateRequest"],
  ["storage_catalog_delete", "Delete a managed Athena storage catalog.", "StorageCatalogIdRequest"],
  ["storage_file_upload", "Create an upload URL for a managed Athena storage file.", "GenericStorageInputRequest"],
  ["storage_file_upload_many", "Create multiple upload URLs for managed Athena storage files in one call.", "GenericStorageInputRequest"],
  ["storage_file_list", "List managed Athena storage files.", "GenericStorageInputRequest"],
  ["storage_file_get", "Get managed Athena storage file metadata.", "StorageFileIdRequest"],
  ["storage_file_update", "Update managed Athena storage file metadata.", "StorageFileUpdateRequest"],
  ["storage_file_delete", "Delete a managed Athena storage file.", "StorageFileIdRequest"],
  ["storage_file_url", "Generate a signed URL for a managed Athena storage file.", "StorageFileUrlRequest"],
  ["storage_file_proxy", "Proxy a managed Athena storage file and return response metadata plus text when the proxied content is text-based.", "StorageFileUrlRequest"],
  ["storage_file_visibility_update", "PATCH-style visibility update for a managed Athena storage file.", "StorageVisibilityRequest"],
  ["storage_file_visibility_set", "POST-style visibility update for a managed Athena storage file.", "StorageVisibilityRequest"],
  ["storage_folder_delete", "Delete a managed Athena storage folder.", "GenericStorageInputRequest"],
  ["storage_folder_move", "Move a managed Athena storage folder.", "GenericStorageInputRequest"],
  ["storage_object_list", "List raw S3-compatible objects through Athena storage.", "GenericStorageInputRequest"],
  ["storage_object_head", "Read object metadata with the raw S3-compatible storage binding.", "GenericStorageInputRequest"],
  ["storage_object_update", "Update object metadata or state with the raw storage binding.", "GenericStorageInputRequest"],
  ["storage_object_url", "Create a signed URL for a raw storage object.", "GenericStorageInputRequest"],
  ["storage_object_delete", "Delete a raw storage object.", "GenericStorageInputRequest"],
  ["storage_object_upload_url", "Create an upload URL for a raw storage object.", "GenericStorageInputRequest"],
  ["storage_object_folder_create", "Create a folder in the raw S3-compatible object namespace.", "GenericStorageInputRequest"],
  ["storage_object_folder_delete", "Delete a folder in the raw S3-compatible object namespace.", "GenericStorageInputRequest"],
  ["storage_object_folder_rename", "Rename a folder in the raw S3-compatible object namespace.", "GenericStorageInputRequest"],
  ["storage_bucket_list", "List buckets visible to the Athena storage binding.", "GenericOptionalStorageInputRequest"],
  ["storage_bucket_create", "Create a bucket through the Athena storage binding.", "GenericStorageInputRequest"],
  ["storage_bucket_delete", "Delete a bucket through the Athena storage binding.", "GenericStorageInputRequest"],
  ["storage_bucket_cors_get", "Read bucket CORS configuration.", "GenericStorageInputRequest"],
  ["storage_bucket_cors_set", "Set bucket CORS configuration.", "GenericStorageInputRequest"],
  ["storage_bucket_cors_delete", "Delete bucket CORS configuration.", "GenericStorageInputRequest"],
  ["list_api_keys", "Experimental admin tool. List Athena API keys using the admin API.", "EmptyRequest"],
  ["create_api_key", "Experimental admin tool. Create an Athena API key. Blocked when read_only mode is enabled.", "CreateApiKeyToolRequest"],
  ["update_api_key", "Experimental admin tool. Update an existing Athena API key. Blocked when read_only mode is enabled.", "UpdateApiKeyToolRequest"],
  ["delete_api_key", "Experimental admin tool. Delete an Athena API key. Blocked when read_only mode is enabled.", "DeleteApiKeyToolRequest"],
  ["list_api_key_rights", "Experimental admin tool. List available Athena API key rights.", "EmptyRequest"],
  ["create_api_key_right", "Experimental admin tool. Create an Athena API key right. Blocked when read_only mode is enabled.", "ApiKeyRightToolRequest"],
  ["update_api_key_right", "Experimental admin tool. Update an Athena API key right. Blocked when read_only mode is enabled.", "UpdateApiKeyRightToolRequest"],
  ["delete_api_key_right", "Experimental admin tool. Delete an Athena API key right. Blocked when read_only mode is enabled.", "DeleteApiKeyToolRequest"],
  ["get_api_key_config", "Experimental admin tool. Read the global Athena API key enforcement configuration.", "EmptyRequest"],
  ["update_api_key_config", "Experimental admin tool. Update global Athena API key enforcement. Blocked when read_only mode is enabled.", "UpdateApiKeyConfigToolRequest"],
  ["list_api_key_clients", "Experimental admin tool. List per-client Athena API key enforcement overrides.", "EmptyRequest"],
  ["save_api_key_client", "Experimental admin tool. Create or update a per-client Athena API key enforcement override. Blocked when read_only mode is enabled.", "SaveApiKeyClientToolRequest"],
  ["delete_api_key_client", "Experimental admin tool. Delete a per-client Athena API key enforcement override. Blocked when read_only mode is enabled.", "DeleteApiKeyClientToolRequest"],
  ["list_athena_clients_admin", "Experimental admin tool. List Athena clients from the database-backed admin catalog.", "EmptyRequest"],
  ["create_athena_client", "Experimental admin tool. Create an Athena client in the admin catalog. Blocked when read_only mode is enabled.", "SaveAthenaClientToolRequest"],
  ["update_athena_client", "Experimental admin tool. Update an Athena client in the admin catalog. Blocked when read_only mode is enabled.", "SaveAthenaClientToolRequest"],
  ["delete_athena_client", "Experimental admin tool. Soft-delete an Athena client from the admin catalog. Blocked when read_only mode is enabled.", "DeleteApiKeyClientToolRequest"],
  ["freeze_athena_client", "Experimental admin tool. Freeze or unfreeze an Athena client. Blocked when read_only mode is enabled.", "FreezeAthenaClientToolRequest"],
  ["list_client_statistics", "Experimental admin tool. List aggregated Athena client statistics from gateway logs.", "EmptyRequest"],
  ["refresh_client_statistics", "Experimental admin tool. Rebuild Athena client statistics from gateway logs. Blocked when read_only mode is enabled.", "EmptyRequest"],
  ["get_client_statistics", "Experimental admin tool. Inspect per-client Athena statistics and touched tables.", "DeleteApiKeyClientToolRequest"],
  ["toggle_supabase_ssl_enforcement", "Experimental admin tool. Enable or disable Supabase SSL enforcement for a project. Blocked when read_only mode is enabled.", "ToggleSupabaseSslEnforcementToolRequest"],
  ["list_router_registry", "List Athena router registry entries.", "EmptyRequest"],
  ["list_registry_entries", "List API registry entries from Athena.", "EmptyRequest"],
  ["get_registry_entry", "Fetch a specific API registry entry by ID.", "GetRegistryEntryToolRequest"],
  ["get_metrics", "Fetch Athena's Prometheus metrics payload.", "EmptyRequest"],
  ["get_embedded_openapi", "Download Athena's embedded OpenAPI YAML document.", "EmptyRequest"],
  ["get_websocket_info", "Read Athena's websocket gateway contract metadata.", "EmptyRequest"],
];

const mcpTools = {
  tools: tools.map(([name, description, ref]) => ({
    name,
    description,
    inputSchema: { $ref: `#/definitions/${ref}` },
  })),
  definitions,
};

fs.writeFileSync(
  path.join(root, "mcp-tools.json"),
  `${JSON.stringify(mcpTools, null, 2)}\n`,
);

function convertRef(value) {
  if (typeof value === "string" && value.startsWith("#/definitions/")) {
    return value.replace("#/definitions/", "#/components/schemas/");
  }
  return value;
}

function deepConvertRefs(obj) {
  if (Array.isArray(obj)) return obj.map(deepConvertRefs);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      out[key] = deepConvertRefs(convertRef(value));
    }
    return out;
  }
  return convertRef(obj);
}

const componentsSchemas = deepConvertRefs(definitions);
componentsSchemas.ToolResult.properties.content.items = {
  $ref: "#/components/schemas/ToolContent",
};

const summaryOverrides = {
  list_tables: "List all tables",
  list_extensions: "List installed PostgreSQL extensions",
  list_migrations: "List applied database migrations",
  apply_migration: "Apply a SQL migration",
  execute_sql: "Execute an arbitrary SQL query",
  get_logs: "Retrieve recent logs",
  get_columns_of_table: "Describe columns using Athena's schema API",
  list_table_metadata: "Return table metadata plus column defaults and nullability",
  list_schemas: "List visible database schemas",
  list_views: "List visible views and materialized views",
  get_row_by_eq_column_of_table: "Fetch rows for column equality conditions",
  list_foreign_keys: "List primary keys, foreign keys, and unique constraints",
  get_table_sample: "Sample rows from a table",
  list_indexes: "List index definitions for a table",
  search_columns: "Find tables and columns by name pattern",
  get_row_by_id: "Fetch rows by primary key value",
  list_all_table_metadata: "Return metadata for all tables",
  insert_row: "Insert a row",
  delete_row: "Delete a row",
  update_row: "Update rows",
  get_api_root: "Fetch Athena API root metadata",
  ping: "Run Athena health check",
  get_cluster_health: "Inspect Athena cluster health",
  get_management_capabilities: "Read management API capabilities",
  create_table: "Create a managed table",
  edit_table: "Edit a managed table",
  drop_table: "Drop a managed table",
  drop_column: "Drop a managed table column",
  create_index: "Create an index",
  drop_index: "Drop an index",
  run_pipeline: "Run an Athena pipeline",
  list_available_clients: "List configured Athena clients",
  list_router_registry: "List router registry entries",
  list_registry_entries: "List registry entries",
  get_registry_entry: "Get a registry entry",
  get_metrics: "Fetch metrics",
  get_embedded_openapi: "Download embedded OpenAPI",
  get_websocket_info: "Read websocket gateway metadata",
};

for (const [name] of tools) {
  if (!summaryOverrides[name]) summaryOverrides[name] = name.replace(/_/g, " ");
}

const pathEntries = {};
for (const [name, description, ref] of tools) {
  pathEntries[`/tools/${name}`] = {
    post: {
      summary: summaryOverrides[name],
      description,
      requestBody: {
        ...(ref === "EmptyRequest" ? {} : { required: true }),
        content: {
          "application/json": {
            schema: { $ref: `#/components/schemas/${ref}` },
          },
        },
      },
      responses: {
        200: {
          description: "Tool result payload",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ToolResult" },
            },
          },
        },
      },
    },
  };
}

const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Athena MCP Tools",
    version: "0.2.0",
    description:
      "MCP tool definitions for the Athena MCP server. Each tool is exposed over POST endpoints so OpenAPI-aware clients can understand the tool inputs and outputs before invoking the corresponding MCP methods. Most request schemas also accept an optional `client` override when the server is configured with multiple allowed Athena clients.",
  },
  servers: [{ url: "https://athena-mcp.example.com/tools" }],
  paths: pathEntries,
  components: { schemas: componentsSchemas },
};

function isSimpleScalar(value) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function quoteString(str) {
  if (str === "") return "''";
  if (
    /^[A-Za-z0-9_./:-]+$/.test(str) &&
    !["true", "false", "null"].includes(str)
  ) {
    return str;
  }
  return JSON.stringify(str);
}

function toYaml(value, indent = 0) {
  const pad = " ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (isSimpleScalar(item)) {
          return `${pad}- ${
            typeof item === "string" ? quoteString(item) : String(item)
          }`;
        }
        const rendered = toYaml(item, indent + 2);
        const lines = rendered.split("\n");
        return `${pad}- ${lines[0].trimStart()}${
          lines.length > 1
            ? `\n${lines
                .slice(1)
                .map((line) => `${" ".repeat(indent + 2)}${line.trimStart()}`)
                .join("\n")}`
            : ""
        }`;
      })
      .join("\n");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, val]) => {
        if (isSimpleScalar(val)) {
          return `${pad}${key}: ${
            typeof val === "string" ? quoteString(val) : String(val)
          }`;
        }
        if (Array.isArray(val) && val.length === 0) return `${pad}${key}: []`;
        if (
          val &&
          typeof val === "object" &&
          !Array.isArray(val) &&
          Object.keys(val).length === 0
        ) {
          return `${pad}${key}: {}`;
        }
        return `${pad}${key}:\n${toYaml(val, indent + 2)}`;
      })
      .join("\n");
  }

  if (value === null) return "null";
  if (typeof value === "string") return quoteString(value);
  return String(value);
}

fs.writeFileSync(
  path.join(root, "athena-mcp-openapi.yaml"),
  `${toYaml(openapi)}\n`,
);
