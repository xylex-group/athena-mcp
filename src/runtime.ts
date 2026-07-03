import type { AthenaSdkClientWithStorage } from "@xylex-group/athena" with {
  "resolution-mode": "require",
};
import { z } from "zod";
import type { AthenaServerConfig } from "./config.js";
import { errorContent } from "./responses.js";

interface AthenaStorageClientOptions {
  client: string | null | undefined;
  experimental: {
    athenaStorageBackend: true;
  };
}

type AthenaCreateClient = (
  baseUrl: string | null | undefined,
  apiKey: string | null | undefined,
  options: AthenaStorageClientOptions,
) => AthenaSdkClientWithStorage<false>;

const { createClient } = require("@xylex-group/athena") as {
  createClient: AthenaCreateClient;
};

interface FetchOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
}

export interface BinarySummary {
  bodyText?: string;
  contentType?: string;
  headers: Record<string, string>;
  ok: boolean;
  status: number;
  statusText: string;
}

export class AthenaRuntime {
  private readonly clientSelectorSchema?: z.ZodType<string | undefined>;
  private readonly storageClients = new Map<
    string,
    AthenaSdkClientWithStorage<false>
  >();

  constructor(public readonly config: AthenaServerConfig) {
    if (config.availableClients.length > 1) {
      this.clientSelectorSchema = z
        .enum(config.availableClients as [string, ...string[]])
        .optional()
        .describe(
          `Optional Athena client override. Allowed values: ${config.availableClients.join(", ")}`,
        );
    }
  }

  public getClientSelectorSchema(): z.ZodType<string | undefined> | undefined {
    return this.clientSelectorSchema;
  }

  public resolveClientName(clientOverride?: string): string {
    const selected = (clientOverride ?? this.config.defaultClient).trim();
    if (!selected) {
      throw new Error("No Athena client was selected.");
    }
    if (!this.config.availableClients.includes(selected)) {
      throw new Error(
        `Athena client "${selected}" is not allowed. Configure ATHENA_AVAILABLE_CLIENTS to include it.`,
      );
    }
    return selected;
  }

  public async apiFetch(
    path: string,
    clientName: string,
    opts: FetchOptions = {},
  ): Promise<unknown> {
    const normalizedPath = `/${path.replace(/^\/+/, "")}`;
    const url = `${this.config.baseUrl}${normalizedPath}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Athena-Client": clientName,
      ...(this.config.apiKey
        ? {
            apikey: this.config.apiKey,
            "x-api-key": this.config.apiKey,
          }
        : {}),
      ...(opts.headers ?? {}),
    };

    const response = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });

    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
      );
    }

    return data;
  }

  public async apiFetchBinary(
    path: string,
    clientName: string,
    opts: Omit<FetchOptions, "headers"> = {},
  ): Promise<BinarySummary> {
    const normalizedPath = `/${path.replace(/^\/+/, "")}`;
    const url = `${this.config.baseUrl}${normalizedPath}`;
    const response = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        "X-Athena-Client": clientName,
        ...(this.config.apiKey
          ? {
              apikey: this.config.apiKey,
              "x-api-key": this.config.apiKey,
            }
          : {}),
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });

    const contentType = response.headers.get("content-type") ?? undefined;
    const bodyText =
      contentType &&
      /json|text|xml|yaml|javascript|html/i.test(contentType)
        ? await response.text()
        : undefined;

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${bodyText ?? response.statusText}`,
      );
    }

    return {
      bodyText,
      contentType,
      headers: Object.fromEntries(response.headers.entries()),
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
  }

  public async runQuery(sql: string, clientName: string): Promise<unknown> {
    const trimmed = sql.trim().replace(/;\s*$/, "");
    return this.apiFetch("/gateway/query", clientName, {
      body: { query: trimmed },
      method: "POST",
    });
  }

  public getStorageSdkClient(clientName: string): AthenaSdkClientWithStorage<false> {
    let client = this.storageClients.get(clientName);
    if (!client) {
      client = createClient(this.config.baseUrl, this.config.apiKey, {
        client: clientName,
        experimental: {
          athenaStorageBackend: true,
        },
      });
      this.storageClients.set(clientName, client);
    }
    return client;
  }
}

export function readOnlyToolError(toolName: string) {
  return errorContent(
    `${toolName} is disabled: server is running in read-only mode.`,
  );
}

export interface ToolContext {
  clientName: string;
  runtime: AthenaRuntime;
}
