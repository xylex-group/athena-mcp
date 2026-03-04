# athena-mcp

MCP server for the [Athena](https://athena-db.com) database gateway. Exposes Athena's PostgreSQL management API as MCP tools for use with LLM agents and AI coding assistants.

## Tool calls

- [x] `search_columns`: Find tables and columns by name pattern
- [x] `list_all_table_metadata`: Return metadata for all tables in one call: schema, name, columns, types, defaults, nullabe
- [x] `list_tables`: List all tables available in the connected database
- [x] `list_extensions`: List all postgreSQL installed extensions
- [x] `execute_sql`: Execute raq SQL query, write is blocked when `read_only` mode is enabled
- [x] `get_columns_of_table`: Describe columns for a table using Athena's schema API
- [x] `list_table_metadata`: Returns the full metadata for a table: schema_name, table_name and each column's name, type, default value and nullable flag
- [x] `list_schemas`: List database schemas visible to the current client
- [x] `list_views`: List views that are visible and optionally materialized views using Athena's schema API
- [x] `list_foreign_keys`: List primary keys, foreign keys and unique constraints for a table, essential for understanding relationships and correct joins
- [x] `get_table_sample`: Sample rows from a table to understand it's data shape. Quick alternative to writing SQL
- [x] `list_indexes`: List index definitions for a table

**Experimental**

- [ ] `list_migrations`: List all migrations (relies on the table)
- [ ] `apply_migration`: Apply a SQL migration against a connected DB, blocked when `read_only` mode is enabled
- [ ] `get_logs`: Retrieve recent database logs (relies on table `logs`)

**Untested**

- [ ] `get_row_by_id`: Fetch rows by primary key column value. Simplifies the common fetch-by-id use case
- [ ] `insert_row`: Insert a row into a table. Blocked when `read_only` mode is enabled
- [ ] `update_row`: Updates rows matching a condition. Blocked when `read_only` mode is enabled
- [ ] `delete_row`: Delete a row by primary key (resource_id). Blocked when `read_only` mode is enabled
- [ ] `get_rows_by_eq_column_of_table`: Fetch rows from a table where `column = value` using Athena's fetch endpoint

## Install

```bash
npm install @xylex-group/athena-mcp
```

```
npx -y --package=git+https://github.com/xylex-group/athena-mcp.git athena-mcp --version
```

Or run without installing:

```bash
npx -y --package=git+https://github.com/xylex-group/athena-mcp.git athena-mcp
```

Or from npm:

```bash
npx -y @xylex-group/athena-mcp
```

## Adding to AI coding assistants

### Cursor

1. Open **Cursor Settings** → **Cursor Tab** → **MCP** (or `Cmd/Ctrl + ,` → search "MCP")
2. Click **Add new MCP server** and configure:
   - **Name:** `athena`
   - **Type:** Command
   - **Command:** `npx`
   - **Args:** `-y`, `--package=git+https://github.com/xylex-group/athena-mcp.git`, `athena-mcp`
   - **Env:** Add `ATHENA_API_KEY`, `ATHENA_CLIENT` (for X-Athena-Client header), `READ_ONLY`, etc.

Or add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": [
        "-y",
        "--package=git+https://github.com/xylex-group/athena-mcp.git",
        "athena-mcp",
        "--athena-api-key=api-key-1234567890",
        "--athena-client=railway_direct",
        "--read-only=false"
      ]
    }
  }
}
```

Or use env (good for secrets):

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": ["-y", "--package=git+https://github.com/xylex-group/athena-mcp.git", "athena-mcp"],
      "env": {
        "ATHENA_API_KEY": "api-key-1234567890",
        "ATHENA_CLIENT": "railway_direct",
        "READ_ONLY": "false"
      }
    }
  }
}
```

Restart Cursor after changing the config.

### VSCode

VSCode supports MCP through extensions like **Continue** or through the native **GitHub Copilot** (if you have access to MCP features).

#### Using Continue Extension

1. Install the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) from the VSCode marketplace
2. Open Continue settings (click the Continue icon in the sidebar → settings gear)
3. Add the MCP server to your `config.json`:

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": [
        "-y",
        "--package=git+https://github.com/xylex-group/athena-mcp.git",
        "athena-mcp"
      ],
      "env": {
        "ATHENA_API_KEY": "<your-api-key>",
        "ATHENA_CLIENT": "railway_direct",
        "READ_ONLY": "true"
      }
    }
  }
}
```

#### Using GitHub Copilot (with MCP support)

> **Note:** GitHub Copilot's MCP integration is evolving and may not yet be publicly available. The configuration structure shown below is illustrative and may differ from the actual implementation. Please check the [official GitHub Copilot documentation](https://docs.github.com/en/copilot) for the most current and accurate MCP setup instructions.

If you have access to GitHub Copilot's MCP features:

1. Open **VSCode Settings** → search for "MCP"
2. Edit the MCP configuration file (typically `settings.json` or a dedicated MCP config)
3. Add the athena server configuration (example structure):

```json
{
  "github.copilot.advanced": {
    "mcp": {
      "servers": {
        "athena": {
          "command": "npx",
          "args": [
            "-y",
            "--package=git+https://github.com/xylex-group/athena-mcp.git",
            "athena-mcp"
          ],
          "env": {
            "ATHENA_API_KEY": "<your-api-key>",
            "ATHENA_CLIENT": "railway_direct",
            "READ_ONLY": "true"
          }
        }
      }
    }
  }
}
```

Reload VSCode after making changes.

### Claude Code

Add the server via CLI:

```bash
claude mcp add athena -- npx -y --package=git+https://github.com/xylex-group/athena-mcp.git athena-mcp
```

Or edit the config file directly:

- **macOS/Linux:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": [
        "-y",
        "--package=git+https://github.com/xylex-group/athena-mcp.git",
        "athena-mcp"
      ],
      "env": {
        "ATHENA_API_KEY": "<your-api-key>",
        "ATHENA_CLIENT": "railway_direct",
        "READ_ONLY": "true"
      }
    }
  }
}
```

For project scope, create `.mcp.json` in your project root and run `claude mcp add --scope project athena -- npx -y --package=git+https://github.com/xylex-group/athena-mcp.git athena-mcp`.

### Windsurf

1. Go to **Plugins** → **Manage plugins** → **View raw config**
2. Add the athena server to the JSON config:

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": [
        "-y",
        "--package=git+https://github.com/xylex-group/athena-mcp.git",
        "athena-mcp"
      ],
      "env": {
        "ATHENA_API_KEY": "<your-api-key>",
        "ATHENA_CLIENT": "railway_direct",
        "READ_ONLY": "true"
      }
    }
  }
}
```

3. Save and refresh Windsurf.

### Zed

1. Open **Settings** → **Features** → **AI** → **MCP**
2. Add a custom server with:
   - **Name:** `athena`
   - **Command:** `npx`
   - **Args:** `-y`, `--package=git+https://github.com/xylex-group/athena-mcp.git`, `athena-mcp`
   - **Env:** `ATHENA_API_KEY`, `ATHENA_CLIENT`, `READ_ONLY`, etc.

Or edit the MCP config JSON in Zed settings and add the same `athena` entry as above.

## Tools

| Tool                            | Description                                                          |
| ------------------------------- | -------------------------------------------------------------------- |
| `list_tables`                   | List all tables in the connected database                            |
| `list_extensions`               | List all installed PostgreSQL extensions                             |
| `list_migrations`               | List applied database migrations                                     |
| `apply_migration`               | Apply a SQL migration (blocked in read-only mode)                    |
| `execute_sql`                   | Execute a raw SQL query (write operations blocked in read-only mode) |
| `get_logs`                      | Retrieve recent database / application logs                          |
| `get_columns_of_table`          | Get column metadata (types, defaults, nullability) for a table       |
| `list_table_metadata`           | Full table metadata: schema, columns, types, defaults, nullable      |
| `list_schemas`                  | List all schemas in the database                                     |
| `list_views`                    | List all views (optionally include materialized views)               |
| `get_row_by_eq_column_of_table` | Look up row(s) where a column equals a value (e.g. user_id=123)      |
| `list_foreign_keys`             | List primary keys, foreign keys, and unique constraints              |
| `get_table_sample`              | Sample rows from a table to understand data shape                    |
| `list_indexes`                  | List index definitions for a table                                   |
| `search_columns`                | Find tables and columns by name pattern                              |
| `get_row_by_id`                 | Fetch rows by primary key value (default column: id)                 |
| `list_all_table_metadata`       | Metadata for all tables in one call                                  |
| `insert_row`                    | Insert a row (blocked in read-only mode)                             |
| `delete_row`                    | Delete a row by primary key (blocked in read-only mode)              |
| `update_row`                    | Update rows matching a condition (blocked in read-only mode)         |
| `ping`                          | Run Athena's `/ping` health check                                    |
| `get_api_root`                  | Fetch Athena root metadata and advertised routes                     |
| `get_cluster_health`            | Read mirror health, latency, and version metadata                    |
| `get_management_capabilities`   | Read management capability/right metadata                            |
| `create_table`                  | Create a managed table (blocked in read-only mode)                   |
| `edit_table`                    | Apply additive table alterations (blocked in read-only mode)         |
| `drop_table`                    | Drop a managed table (blocked in read-only mode)                     |
| `drop_column`                   | Drop a managed column (blocked in read-only mode)                    |
| `create_index`                  | Create an index via management API (blocked in read-only mode)       |
| `drop_index`                    | Drop an index via management API (blocked in read-only mode)         |
| `run_pipeline`                  | Execute a config-driven Athena pipeline                              |
| `list_available_clients`        | List Athena/Postgres clients exposed by the admin API                |
| `list_api_keys`                 | List Athena API keys                                                 |
| `create_api_key`                | Create an Athena API key (blocked in read-only mode)                 |
| `update_api_key`                | Update an Athena API key (blocked in read-only mode)                 |
| `delete_api_key`                | Delete an Athena API key (blocked in read-only mode)                 |
| `list_api_key_rights`           | List available API key rights                                        |
| `create_api_key_right`          | Create an API key right (blocked in read-only mode)                  |
| `update_api_key_right`          | Update an API key right (blocked in read-only mode)                  |
| `delete_api_key_right`          | Delete an API key right (blocked in read-only mode)                  |
| `get_api_key_config`            | Read global API key enforcement config                               |
| `update_api_key_config`         | Update API key enforcement config (blocked in read-only mode)        |
| `list_api_key_clients`          | List per-client API key enforcement overrides                        |
| `save_api_key_client`           | Upsert a client enforcement override (blocked in read-only mode)     |
| `delete_api_key_client`         | Delete a client enforcement override (blocked in read-only mode)     |
| `list_athena_clients_admin`     | List Athena clients from the admin catalog                           |
| `create_athena_client`          | Create an Athena client (blocked in read-only mode)                  |
| `update_athena_client`          | Update an Athena client (blocked in read-only mode)                  |
| `delete_athena_client`          | Soft-delete an Athena client (blocked in read-only mode)             |
| `freeze_athena_client`          | Freeze/unfreeze an Athena client (blocked in read-only mode)         |
| `list_client_statistics`        | List aggregated client statistics                                    |
| `refresh_client_statistics`     | Rebuild client statistics (blocked in read-only mode)                |
| `get_client_statistics`         | Read per-client statistics and touched tables                        |
| `toggle_supabase_ssl_enforcement` | Toggle Supabase SSL enforcement (blocked in read-only mode)          |
| `list_router_registry`          | List router registry entries                                         |
| `list_registry_entries`         | List API registry entries                                            |
| `get_registry_entry`            | Fetch an API registry entry by ID                                    |
| `get_metrics`                   | Fetch Prometheus metrics                                             |
| `get_embedded_openapi`          | Download Athena's embedded OpenAPI YAML                              |
| `get_websocket_info`            | Read websocket gateway contract metadata                             |

Tool schemas are documented in [`mcp-tools.json`](mcp-tools.json) (MCP-native) and [`athena-mcp-openapi.yaml`](athena-mcp-openapi.yaml) (OpenAPI 3.0).

## Configuration

Set the following environment variables before starting the server:

| Variable          | Description                                                                      | Default                         |
| ----------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| `ATHENA_BASE_URL` | Base URL of the Athena API                                                       | `https://mirror3.athena-db.com` |
| `ATHENA_API_KEY`  | API key (sent as `apikey` / `x-api-key` headers)                                 | _(empty)_                       |
| `ATHENA_CLIENT`   | Value for the `X-Athena-Client` API header (e.g. `railway_direct`, `postgresql`) | `railway_direct`                |
| `READ_ONLY`       | Set to `true` to disable write operations                                        | `false`                         |
| `HEALTH_PORT`     | Port for HTTP health server (GET /health returns version). Omit to disable       | _(disabled)_                    |

These can also be passed as CLI args (override env vars):

```bash
npx -y --package=git+https://github.com/xylex-group/athena-mcp.git athena-mcp --athena-base-url=https://api.example.com --athena-api-key=xxx --athena-client=railway_direct --read-only
```

Or with the published package:

```bash
npx -y @xylex-group/athena-mcp --athena-base-url=https://api.example.com --athena-api-key=xxx --athena-client=railway_direct --read-only
```

### Read-only mode

When `READ_ONLY=true`:

- `apply_migration`, `insert_row`, `delete_row`, `update_row`, `create_table`, `edit_table`, `drop_table`, `drop_column`, `create_index`, `drop_index`, `create_api_key`, `update_api_key`, `delete_api_key`, `create_api_key_right`, `update_api_key_right`, `delete_api_key_right`, `update_api_key_config`, `save_api_key_client`, `delete_api_key_client`, `create_athena_client`, `update_athena_client`, `delete_athena_client`, `freeze_athena_client`, `refresh_client_statistics`, and `toggle_supabase_ssl_enforcement` return an error immediately.
- `execute_sql` rejects queries containing write keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `REPLACE`).

## Usage (generic MCP config)

Most MCP clients use this format:

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": [
        "-y",
        "--package=git+https://github.com/xylex-group/athena-mcp.git",
        "athena-mcp"
      ],
      "env": {
        "ATHENA_API_KEY": "<your-api-key>",
        "ATHENA_CLIENT": "railway_direct",
        "READ_ONLY": "true"
      }
    }
  }
}
```

## Development

```bash
npm install
npm run build      # tsup (default, fast)
npm run build:tsc  # plain TypeScript compiler
npm run build:rollup  # Rollup bundle
npm start
```

### Testing

```bash
npm run test        # Run tests once
npm run test:watch  # Run tests in watch mode
```

### Linting

```bash
npm run lint       # Check for issues
npm run lint:fix   # Auto-fix issues
```
