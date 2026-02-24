# athena-mcp

MCP server for the [Athena](https://athena-db.com) database gateway. Exposes Athena's PostgreSQL management API as MCP tools for use with LLM agents and AI coding assistants.

## Tools

| Tool | Description |
|------|-------------|
| `list_tables` | List all tables in the connected database |
| `list_extensions` | List all installed PostgreSQL extensions |
| `list_migrations` | List applied database migrations |
| `apply_migration` | Apply a SQL migration (blocked in read-only mode) |
| `execute_sql` | Execute a raw SQL query (write operations blocked in read-only mode) |
| `get_logs` | Retrieve recent database / application logs |

## Configuration

Set the following environment variables before starting the server:

| Variable | Description | Default |
|----------|-------------|---------|
| `ATHENA_BASE_URL` | Base URL of the Athena API | `https://mcp.athena-db.com` |
| `ATHENA_API_KEY` | API key (sent as `apikey` / `x-api-key` headers) | _(empty)_ |
| `ATHENA_CLIENT` | Value for the `X-Athena-Client` header | `postgresql` |
| `READ_ONLY` | Set to `true` to disable write operations | `false` |

### Read-only mode

When `READ_ONLY=true`:
- `apply_migration` returns an error immediately.
- `execute_sql` rejects queries containing write keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `REPLACE`).

## Usage

```json
{
  "mcpServers": {
    "athena": {
      "command": "npx",
      "args": ["athena-mcp"],
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
npm run build
npm start
```

### Testing

```bash
npm run test        # Run tests once
npm run test:watch  # Run tests in watch mode
```
