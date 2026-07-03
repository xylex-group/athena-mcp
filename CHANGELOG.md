# Changelog

## Unreleased / 0.4.0

### Major Additions — Comprehensive SDK + Route Coverage (0.4.0)

- Full interfacing of the `@xylex-group/athena` SDK as first-class MCP tools:
  - **Auth module**: `auth_get_session`, `auth_get_user`, `auth_sign_*`, `auth_refresh_token`, `auth_forgot/reset_password`, admin user management.
  - **Chat module**: complete room + message + realtime surface (`chat_list_*`, `chat_send_message`, `chat_get_realtime_info`, search, etc.).
  - **SDK DB builders**: `sdk_db_select` (fluent relations/filters), insert/upsert/update/delete, rpc, raw query, `sdk_verify_connection`.
- Direct low-level gateway + management tools for parity with the OpenAPI spec: `gateway_*`, `list_*_management`, etc.
- All new tools are separate named tool calls, fully documented, respect client routing and read-only mode.
- Greatly improved runtime helpers (`performAuth`, `performChat`, `sdkRequest`) for reliable SDK usage with graceful fallbacks.

### Documentation

- Created comprehensive **per-tool reference**: `docs/TOOLS.md` (categorized + detailed entries for every tool including inputs, behavior, backend mapping, read-only semantics, and usage notes).
- Richer descriptions added across data, auth, chat, sdk-db, and gateway tools.
- README now prominently links the full `docs/TOOLS.md` reference.
- Regenerated `mcp-tools.json` and `athena-mcp-openapi.yaml` (now reflects 169 tools + improved docs).

### Other

- Updated generator (`scripts/generate-tool-artifacts.js`) with many new schemas.
- New test file exercising registration of all SDK module surfaces.
- All tests + build pass.
- Version bumped to 0.4.0 and published.

See `docs/TOOLS.md` for the authoritative human-readable catalog of every tool.

## [0.1.7-exp](https://github.com/xylex-group/athena-mcp/releases/tag/v0.1.7-exp) (2026-03-02)

- Release channel: experimental
- Tag: `v0.1.7-exp`

