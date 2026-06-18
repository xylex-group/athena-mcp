import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AthenaRuntime, ToolContext } from "./runtime.js";

type RawShape = z.ZodRawShape;

interface ToolDefinition<TInput extends Record<string, unknown>> {
  description: string;
  handler: (context: ToolContext, input: TInput) => Promise<unknown>;
  name: string;
  shape?: RawShape;
}

export function registerTool<TInput extends Record<string, unknown>>(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: ToolDefinition<TInput>,
): void {
  const shape: RawShape = { ...(definition.shape ?? {}) };
  const clientSelector = runtime.getClientSelectorSchema();
  if (clientSelector) {
    shape.client = clientSelector;
  }

  server.tool(
    definition.name,
    definition.description,
    shape,
    async (input = {}) => {
      const typedInput = input as Record<string, unknown>;
      const selectedClient = runtime.resolveClientName(
        typeof typedInput.client === "string" ? typedInput.client : undefined,
      );
      const rest = { ...typedInput };
      delete rest.client;
      return definition.handler(
        {
          clientName: selectedClient,
          runtime,
        },
        rest as TInput,
      );
    },
  );
}
