import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AthenaRuntime, ToolContext } from "./runtime.js";
import { logger } from "./logger.js";
import { errorContent } from "./responses.js";

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

/** Wraps a tool handler so that:
 *  - every call is timed + logged (input + success/failure + duration)
 *  - errors are caught, richly logged (incl stack), and turned into errorContent
 *  - never lets exceptions escape to the MCP layer (prevents abrupt stops)
 */
function wrapHandler(
  toolName: string,
  runtime: AthenaRuntime,
  realHandler: (ctx: ToolContext, input?: unknown) => Promise<CallToolResult>,
): (rawInput?: unknown) => Promise<CallToolResult> {
  return async (rawInput?: unknown) => {
    const start = Date.now();
    let clientName = "unknown";
    let success = false;
    let result: CallToolResult | undefined;
    let errorMsg: string | undefined;

    try {
      // Resolve client early (may throw, which is a config error we want to capture)
      const override = (rawInput as any)?.client;
      clientName = runtime.resolveClientName(
        typeof override === "string" ? override : undefined,
      );

      const ctx: ToolContext = { clientName, runtime };
      // call without the client field for handler
      const inputForHandler = rawInput && typeof rawInput === "object"
        ? { ...(rawInput as Record<string, unknown>) }
        : rawInput;
      if (inputForHandler && typeof inputForHandler === "object" && "client" in (inputForHandler as any)) {
        delete (inputForHandler as any).client;
      }

      result = await realHandler(ctx, inputForHandler);

      success = !(result as any)?.isError;
    } catch (err: any) {
      success = false;
      const stack = err?.stack ? String(err.stack) : undefined;
      errorMsg = err?.message ? String(err.message) : String(err);

      // Rich error logging
      logger.error(`Tool execution failed: ${toolName}`, {
        tool: toolName,
        client: clientName,
        error: errorMsg,
        stack: stack?.split("\n").slice(0, 8).join("\n"),
        inputPreview: rawInput ? JSON.stringify(redactForLog(rawInput)).slice(0, 800) : undefined,
      }).catch(() => {});

      result = errorContent(
        `Error in ${toolName}: ${errorMsg}${stack ? "\n" + stack.split("\n")[0] : ""}`,
      );
    } finally {
      const durationMs = Date.now() - start;
      const outputPreview = success && result
        ? (typeof (result as any).content?.[0]?.text === "string"
            ? (result as any).content[0].text
            : undefined)
        : undefined;

      // Fire and await the structured log (includes stats update)
      logger.logToolCall({
        tool: toolName,
        client: clientName,
        durationMs,
        success,
        input: rawInput,
        outputPreview: typeof outputPreview === "string" ? outputPreview : undefined,
        error: errorMsg,
      }).catch(() => {
        // never let logging kill the response
      });
    }

    return result!;
  };
}

function redactForLog(v: unknown): unknown {
  if (!v || typeof v !== "object") return v;
  const copy: any = Array.isArray(v) ? [...v] : { ...v };
  const keys = Object.keys(copy);
  for (const k of keys) {
    const lk = k.toLowerCase();
    if (lk.includes("key") || lk.includes("token") || lk.includes("secret") || lk.includes("password")) {
      copy[k] = "[REDACTED]";
    } else if (typeof copy[k] === "object" && copy[k] !== null) {
      copy[k] = redactForLog(copy[k]);
    }
  }
  return copy;
}

function registerToolWithoutShape(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: ToolDefinitionWithoutShape,
  clientSelector?: z.ZodType<string | undefined>,
): void {
  const realHandler = async (ctx: ToolContext) => definition.handler(ctx);

  if (clientSelector) {
    const wrapped = wrapHandler(definition.name, runtime, async (ctx, input) => {
      // client already resolved inside wrapHandler
      return realHandler(ctx!);
    });

    const callback = (async (input: { client?: unknown }) => {
      return wrapped(input);
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

  const wrapped = wrapHandler(definition.name, runtime, async (ctx) => realHandler(ctx!));
  const callback = (async () => wrapped(undefined)) as unknown as ToolCallback;

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
  const realHandler = async (ctx: ToolContext, input: unknown) =>
    definition.handler(ctx, input as ToolInput<TShape>);

  if (!clientSelector) {
    const wrapped = wrapHandler(definition.name, runtime, realHandler);
    const callback = (async (input: ToolInput<TShape>) => wrapped(input)) as unknown as ToolCallback<TShape>;

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

  const wrapped = wrapHandler(definition.name, runtime, realHandler);
  const callback = (async (input: ToolInput<TShape> & { client?: unknown }) => {
    return wrapped(input);
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

export function registerTool<TShape extends z.ZodRawShape>(
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
