const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mcpTools = JSON.parse(fs.readFileSync(path.join(root, 'mcp-tools.json'), 'utf8'));
const tools = mcpTools.tools;
const defs = mcpTools.definitions || {};

function groupTools(tools) {
  const groups = {};
  tools.forEach(tool => {
    let prefix = tool.name.split('_')[0];
    if (['get', 'list', 'create', 'update', 'delete', 'storage'].includes(prefix)) {
      if (tool.name.startsWith('storage_')) prefix = 'storage';
      else if (tool.name.includes('api_key')) prefix = 'api_keys';
      else if (tool.name.includes('athena_client')) prefix = 'admin_clients';
      else prefix = 'data';
    }
    if (tool.name.startsWith('auth_')) prefix = 'auth';
    if (tool.name.startsWith('chat_')) prefix = 'chat';
    if (tool.name.startsWith('sdk_')) prefix = 'sdk';
    if (tool.name.startsWith('gateway_') || tool.name.includes('management')) prefix = 'gateway';
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(tool);
  });
  return groups;
}

const groups = groupTools(tools);

let mdx = `---
title: MCP Tools Reference
description: Complete reference for every tool exposed by the Athena MCP server (@xylex-group/athena-mcp). Each tool is documented with description, inputs, read-only behavior, and backend mapping.
---

# Athena MCP Tools Reference

**Package:** \`@xylex-group/athena-mcp\`  
**Total Tools:** ${tools.length}  
**Version:** See package.json (currently ~0.4.0)

## Important Notes

- Every tool supports an optional \`client\` parameter (only exposed when multiple clients are configured via \`ATHENA_AVAILABLE_CLIENTS\`).
- **Read-only mode** (\`READ_ONLY=true\`): All tools that modify data, create resources, or perform admin mutations are blocked and return an error. \`execute_sql\` and similar also reject write statements.
- Tools use the configured \`ATHENA_BASE_URL\`, API key, and client routing.
- For exact JSON schemas, see \`mcp-tools.json\` and \`athena-mcp-openapi.yaml\` in the package.
- Many tools are thin wrappers around Athena's HTTP API or the official SDK (\`@xylex-group/athena\`).

`;

const categoryTitles = {
  data: 'Data, Schema & Query Tools',
  storage: 'Storage Tools (Managed + Raw Object)',
  api_keys: 'API Keys & Rights',
  admin_clients: 'Admin Client Catalog',
  auth: 'Auth SDK Tools',
  chat: 'Chat SDK Tools',
  sdk: 'SDK DB & Core Tools',
  gateway: 'Direct Gateway & Management Tools',
  registry: 'Registry & Observability'
};

Object.keys(groups).sort().forEach(key => {
  const title = categoryTitles[key] || (key.charAt(0).toUpperCase() + key.slice(1) + ' Tools');
  mdx += `## ${title}\n\n`;

  groups[key].forEach(tool => {
    mdx += `### \`${tool.name}\`\n\n`;
    mdx += `${tool.description}\n\n`;

    // Try to infer input
    const schemaRef = tool.inputSchema && tool.inputSchema.$ref ? tool.inputSchema.$ref.replace('#/definitions/', '') : null;
    if (schemaRef && defs[schemaRef]) {
      const schema = defs[schemaRef];
      mdx += `**Input schema:** \`${schemaRef}\`\n\n`;
      if (schema.properties) {
        mdx += 'Parameters:\n';
        Object.entries(schema.properties).forEach(([prop, propSchema]) => {
          const desc = propSchema.description || (propSchema.type ? propSchema.type : '');
          const req = (schema.required || []).includes(prop) ? ' (required)' : '';
          mdx += `- \`${prop}\`${req}: ${desc}\n`;
        });
        mdx += '\n';
      }
    } else {
      mdx += `**Input:** Minimal or empty (see \`EmptyRequest\` for client override).\n\n`;
    }

    const isWrite = /create|insert|update|delete|drop|apply|sign_up|sign_in|send|archive|freeze|refresh|toggle|purge|grant|revoke|save|upload/i.test(tool.name) || 
                     tool.description.toLowerCase().includes('blocked when read_only');
    mdx += `**Read-only safe:** ${isWrite ? 'No (blocked in READ_ONLY mode)' : 'Yes'}\n\n`;

    // Backend hints
    let backend = 'Athena HTTP API or SDK';
    if (tool.name.startsWith('storage_')) backend = 'Athena Storage (SDK + /storage/*)';
    else if (tool.name.startsWith('auth_')) backend = '@xylex-group/athena SDK auth module + /auth/*';
    else if (tool.name.startsWith('chat_')) backend = '@xylex-group/athena SDK chat module + /chat/*';
    else if (tool.name.startsWith('sdk_')) backend = '@xylex-group/athena SDK (db, request)';
    else if (tool.name.startsWith('gateway_')) backend = 'Direct /gateway/* or /management/*';
    else if (['list_api_keys','create_api_key'].some(p => tool.name.includes(p.split('_')[1]))) backend = '/admin/api-keys and rights';
    else if (tool.name.includes('client')) backend = '/admin/clients';
    else if (['list_tables','get_columns','list_schemas'].some(p => tool.name.includes(p))) backend = '/schema/*';
    else if (['execute_sql','insert_row'].some(p => tool.name.includes(p.split('_')[0]))) backend = '/gateway/* or /query/*';
    mdx += `**Backend:** ${backend}\n\n`;

    mdx += '---\n\n';
  });
});

mdx += `
## Additional Resources

- Full machine-readable: \`mcp-tools.json\`, \`athena-mcp-openapi.yaml\`
- Source: https://github.com/xylex-group/athena-mcp
- Integrated in main Athena docs: see this page and related mcp-server docs.

*This reference can be regenerated from \`scripts/generate-mcp-docs.js\` using the current mcp-tools.json.*
`;

fs.writeFileSync(path.join(root, 'docs', 'TOOLS-REFERENCE.md'), mdx);
console.log('Generated docs/TOOLS-REFERENCE.md with ' + tools.length + ' tools.');

// Also output for the external docs site (can be copied or used)
fs.writeFileSync(path.join(root, 'docs', 'tools-reference.mdx'), mdx.replace('---', '---\n# ... (Fumadocs compatible)'));
console.log('Also wrote docs/tools-reference.mdx (MDX variant).');
