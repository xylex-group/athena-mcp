# athena-mcp

MCP server for the [Athena](https://athena-db.com) database gateway. Exposes Athena's PostgreSQL management API as MCP tools for use with LLM agents and AI coding assistants.

## Install

```bash
npm install @xylex-group/athena-mcp
```

```
npx -y --package=git+https://github.com/xylex-group/athena-mcp.git athena-mcp --version
```

Or run without installing:

```bash
npx @xylex-group/athena-mcp
```

## Adding to AI coding assistants

### Cursor

1. Open **Cursor Settings** → **Cursor Tab** → **MCP** (or `Cmd/Ctrl + ,` → search "MCP")
2. Click **Add new MCP server** and configure:
   - **Name:** `athena`
   - **Type:** Command
   - **Command:** `npx`
   - **Args:** `@xylex-group/athena-mcp`
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
        "athena-mcp"
      ],
      "env": {
        "ATHENA_API_KEY": "api-key-1234567890",
        "ATHENA_CLIENT": "xxxx",
        "READ_ONLY": "false"
      }
    }
  }
}
```

Restart Cursor after changing the config.

### Claude Code

Add the server via CLI:

```bash
claude mcp add athena -- npx @xylex-group/athena-mcp
```

Or edit the config file directly:

- **macOS/Linux:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": ["@xylex-group/athena-mcp"],
      "env": {
        "ATHENA_API_KEY": "<your-api-key>",
        "ATHENA_CLIENT": "postgresql",
        "READ_ONLY": "true"
      }
    }
  }
}
```

For project scope, create `.mcp.json` in your project root and run `claude mcp add --scope project athena -- npx @xylex-group/athena-mcp`.

### Windsurf

1. Go to **Plugins** → **Manage plugins** → **View raw config**
2. Add the athena server to the JSON config:

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": ["@xylex-group/athena-mcp"],
      "env": {
        "ATHENA_API_KEY": "<your-api-key>",
        "ATHENA_CLIENT": "postgresql",
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
   - **Args:** `@xylex-group/athena-mcp`
   - **Env:** `ATHENA_API_KEY`, `ATHENA_CLIENT`, `READ_ONLY`, etc.

Or edit the MCP config JSON in Zed settings and add the same `athena` entry as above.

## Tools

| Tool                           | Description                                                          |
| ------------------------------ | -------------------------------------------------------------------- |
| `list_tables`                  | List all tables in the connected database                            |
| `list_extensions`              | List all installed PostgreSQL extensions                             |
| `list_migrations`              | List applied database migrations                                     |
| `apply_migration`              | Apply a SQL migration (blocked in read-only mode)                     |
| `execute_sql`                  | Execute a raw SQL query (write operations blocked in read-only mode)  |
| `get_logs`                     | Retrieve recent database / application logs                          |
| `get_columns_of_table`         | Get column metadata (types, defaults, nullability) for a table        |
| `list_table_metadata`          | Full table metadata: schema, columns, types, defaults, nullable      |
| `list_schemas`                 | List all schemas in the database                                      |
| `list_views`                   | List all views (optionally include materialized views)                |
| `get_row_by_eq_column_of_table` | Look up row(s) where a column equals a value (e.g. user_id=123)     |
| `list_foreign_keys`            | List primary keys, foreign keys, and unique constraints               |
| `get_table_sample`             | Sample rows from a table to understand data shape                    |
| `list_indexes`                 | List index definitions for a table                                   |
| `search_columns`               | Find tables and columns by name pattern                               |
| `get_row_by_id`                | Fetch rows by primary key value (default column: id)                  |
| `list_all_table_metadata`      | Metadata for all tables in one call                                  |
| `insert_row`                   | Insert a row (blocked in read-only mode)                             |
| `delete_row`                   | Delete a row by primary key (blocked in read-only mode)               |
| `update_row`                   | Update rows matching a condition (blocked in read-only mode)          |

Tool schemas are documented in [`mcp-tools.json`](mcp-tools.json) (MCP-native) and [`athena-mcp-openapi.yaml`](athena-mcp-openapi.yaml) (OpenAPI 3.0).

## Configuration

Set the following environment variables before starting the server:

| Variable          | Description                                                                | Default                     |
| ----------------- | -------------------------------------------------------------------------- | --------------------------- |
| `ATHENA_BASE_URL` | Base URL of the Athena API                                                 | `https://pool.athena-db.com` |
| `ATHENA_API_KEY`  | API key (sent as `apikey` / `x-api-key` headers)                           | _(empty)_                   |
| `ATHENA_CLIENT`   | Value for the `X-Athena-Client` API header (e.g. `postgresql`, `supabase`) | `postgresql`                |
| `READ_ONLY`       | Set to `true` to disable write operations                                  | `false`                     |
| `HEALTH_PORT`     | Port for HTTP health server (GET /health returns version). Omit to disable | _(disabled)_                |

### Read-only mode

When `READ_ONLY=true`:

- `apply_migration`, `insert_row`, `delete_row`, and `update_row` return an error immediately.
- `execute_sql` rejects queries containing write keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `REPLACE`).

## Usage (generic MCP config)

Most MCP clients use this format:

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": ["@xylex-group/athena-mcp"],
      "env": {
        "ATHENA_API_KEY": "<your-api-key>",
        "ATHENA_CLIENT": "postgresql",
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
