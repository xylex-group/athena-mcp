import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AthenaRuntime, ToolContext } from "./runtime.js";

type MutableRawShape<TShape extends z.ZodRawShape> = {
  -readonly [K in keyof TShape]: TShape[K];
};

type ToolInput<TShape extends z.ZodRawShape> = z.output<z.ZodObject<TShape>>;

interface ToolDefinitionBase {
  description: string;
  name: string;
}

interface ToolDefinitionWithoutShape extends ToolDefinitionBase {
  handler: (context: ToolContext) => Promise<CallToolResult>;
  shape?: undefined;
}

interface ToolDefinitionWithShape<TShape extends z.ZodRawShape>
  extends ToolDefinitionBase {
  handler: (
    context: ToolContext,
    input: ToolInput<TShape>,
  ) => Promise<CallToolResult>;
  shape: TShape;
}

function hasShape<TShape extends z.ZodRawShape>(
  definition: ToolDefinitionWithoutShape | ToolDefinitionWithShape<TShape>,
): definition is ToolDefinitionWithShape<TShape> {
  return definition.shape !== undefined;
}

function registerToolWithoutShape(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: ToolDefinitionWithoutShape,
  clientSelector?: z.ZodType<string | undefined>,
): void {
  if (clientSelector) {
    const callback = (async (input: { client?: unknown }) => {
      const clientOverride = input.client;
      const selectedClient = runtime.resolveClientName(
        typeof clientOverride === "string" ? clientOverride : undefined,
      );
      return definition.handler({
        clientName: selectedClient,
        runtime,
      });
    }) as unknown as ToolCallback<{ client: z.ZodType<string | undefined> }>;

    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: { client: clientSelector },
      },
      callback,
    );
    return;
  }

  const callback = (async () =>
    definition.handler({
      clientName: runtime.resolveClientName(),
      runtime,
    })) as unknown as ToolCallback;

  server.registerTool(
    definition.name,
    {
      description: definition.description,
    },
    callback,
  );
}

function registerToolWithShape<TShape extends z.ZodRawShape>(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: ToolDefinitionWithShape<TShape>,
  clientSelector?: z.ZodType<string | undefined>,
): void {
  if (!clientSelector) {
    const callback = (async (input: ToolInput<TShape>) =>
      definition.handler(
        {
          clientName: runtime.resolveClientName(),
          runtime,
        },
        input,
      )) as unknown as ToolCallback<TShape>;

    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: definition.shape,
      },
      callback,
    );
    return;
  }

  const inputSchema: MutableRawShape<TShape> & {
    client: z.ZodType<string | undefined>;
  } = {
    ...(definition.shape as MutableRawShape<TShape>),
    client: clientSelector,
  };

  const callback = (async (input: ToolInput<TShape> & { client?: unknown }) => {
    const { client: clientOverride, ...rest } = input;
    const selectedClient = runtime.resolveClientName(
      typeof clientOverride === "string" ? clientOverride : undefined,
    );
    return definition.handler(
      {
        clientName: selectedClient,
        runtime,
      },
      rest as ToolInput<TShape>,
    );
  }) as unknown as ToolCallback<
    MutableRawShape<TShape> & {
      client: z.ZodType<string | undefined>;
    }
  >;

  server.registerTool(
    definition.name,
    {
      description: definition.description,
      inputSchema,
    },
    callback,
  );
}

export function registerTool(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: ToolDefinitionWithoutShape,
): void;

export function registerTool<TShape extends z.ZodRawShape = {}>(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: ToolDefinitionWithShape<TShape>,
): void;

export function registerTool<TShape extends z.ZodRawShape>(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: ToolDefinitionWithoutShape | ToolDefinitionWithShape<TShape>,
): void {
  const clientSelector = runtime.getClientSelectorSchema();
  if (hasShape(definition)) {
    registerToolWithShape(server, runtime, definition, clientSelector);
    return;
  }
  registerToolWithoutShape(server, runtime, definition, clientSelector);
}
