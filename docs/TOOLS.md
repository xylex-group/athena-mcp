# Athena MCP Tools Documentation

**Comprehensive reference for all tools in @xylex-group/athena-mcp.**

See the generated full reference:

- [TOOLS-REFERENCE.md](./TOOLS-REFERENCE.md) — Full documentation for **each of the 169 tools**, with descriptions, input parameters, read-only status, and backend mappings.

The identical comprehensive reference is also written to the main Athena documentation site at:
`C:\Users\floris\documents\github\athena\apps\docs\content\docs\mcp-server\tools-reference.mdx`

This file is auto-generated from `mcp-tools.json` using `scripts/generate-mcp-docs.js`.

## Quick Links

- Full reference (all tools): [TOOLS-REFERENCE.md](./TOOLS-REFERENCE.md)
- Machine readable: [mcp-tools.json](../mcp-tools.json)
- OpenAPI for tools: [athena-mcp-openapi.yaml](../athena-mcp-openapi.yaml)
- Source code: `src/tools/`

## Also available in main Athena documentation

Canonical integrated docs (Fumadocs/MDX) live at:

`C:\Users\floris\documents\github\athena\apps\docs\content\docs\mcp-server\tools-reference.mdx`

(and related pages: overview, tool-categories, tool-endpoint-mapping, etc.)

## Major Categories Covered

- Schema & Data discovery and CRUD
- Migrations, logs, pipelines
- Health, cluster, registry, metrics
- Table management (DDL)
- Extensive Storage (77 tools: managed files, raw objects, buckets, multipart, permissions, audit)
- Admin clients and statistics
- Full API Keys + Rights + Enforcement
- **SDK surfaces**: Auth (sign in/up, sessions, admin users), Chat (rooms, messages, realtime, search), DB builders (select with relations, insert/update/delete/rpc)
- Direct gateway routes

All tools properly support client overrides and respect READ_ONLY mode.

Run `node scripts/generate-mcp-docs.js` after updating tool registrations or the generator to refresh the reference docs.
