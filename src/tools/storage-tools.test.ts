import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerStorageTools } from "./storage-tools.js";

interface RegisteredTool {
  callback: (...args: unknown[]) => Promise<unknown>;
  config: { description: string; inputSchema?: Record<string, unknown> };
  name: string;
}

function createServerDouble(): {
  registerTool: (
    name: string,
    config: { description: string; inputSchema?: Record<string, unknown> },
    callback: (...args: unknown[]) => Promise<unknown>,
  ) => void;
  tools: Map<string, RegisteredTool>;
} {
  const tools = new Map<string, RegisteredTool>();

  return {
    tools,
    registerTool(name, config, callback) {
      tools.set(name, { callback, config, name });
    },
  };
}

function parseToolResult(result: unknown): unknown {
  const text = (result as { content: [{ text: string }] }).content[0].text;
  return JSON.parse(text);
}

describe("registerStorageTools", () => {
  it("registers the expanded storage SDK surface", () => {
    const server = createServerDouble();
    const runtime = {
      getClientSelectorSchema: () => undefined,
    } as const;

    registerStorageTools(server as never, runtime as never);

    expect([...server.tools.keys()]).toEqual(
      expect.arrayContaining([
        "storage_file_confirm_upload",
        "storage_file_upload_binary",
        "storage_file_search",
        "storage_file_update_many",
        "storage_file_delete_many",
        "storage_file_restore",
        "storage_file_purge",
        "storage_file_copy",
        "storage_file_public_url",
        "storage_file_proxy_url",
        "storage_file_visibility_set_many",
        "storage_file_versions",
        "storage_file_version_restore",
        "storage_file_version_delete",
        "storage_file_retention_get",
        "storage_file_retention_set",
        "storage_folder_list",
        "storage_folder_tree",
        "storage_permission_list",
        "storage_permission_grant",
        "storage_permission_revoke",
        "storage_permission_check",
        "storage_object_exists",
        "storage_object_validate",
        "storage_object_copy",
        "storage_object_public_url",
        "storage_object_versions",
        "storage_object_version_restore",
        "storage_object_version_delete",
        "storage_object_post_policy",
        "storage_bucket_lifecycle_get",
        "storage_bucket_lifecycle_set",
        "storage_bucket_lifecycle_delete",
        "storage_bucket_policy_get",
        "storage_bucket_policy_set",
        "storage_bucket_policy_delete",
        "storage_bucket_public_access_get",
        "storage_bucket_public_access_set",
        "storage_bucket_public_access_delete",
        "storage_multipart_create",
        "storage_multipart_sign_part",
        "storage_multipart_complete",
        "storage_multipart_abort",
        "storage_multipart_list_parts",
        "storage_audit_list",
      ]),
    );
  });

  it("uses the client override and strips it before forwarding opaque input", async () => {
    const exists = vi.fn().mockResolvedValue({ ok: true });
    const resolveClientName = vi.fn().mockReturnValue("analytics");
    const server = createServerDouble();
    const runtime = {
      getClientSelectorSchema: () => z.enum(["primary", "analytics"]).optional(),
      getStorageSdkClient: vi.fn().mockReturnValue({
        storage: {
          object: { exists },
        },
      }),
      resolveClientName,
    };

    registerStorageTools(server as never, runtime as never);

    const tool = server.tools.get("storage_object_exists");
    expect(tool).toBeDefined();
    expect(tool?.config.inputSchema).toHaveProperty("client");

    const result = await tool?.callback({
      client: "analytics",
      input: {
        endpoint: "https://s3.example.com",
        region: "eu-west-1",
        access_key_id: "ak",
        secret_key: "sk",
        bucket: "bucket",
        key: "file.txt",
      },
    });

    expect(resolveClientName).toHaveBeenCalledWith("analytics");
    expect(runtime.getStorageSdkClient).toHaveBeenCalledWith("analytics");
    expect(exists).toHaveBeenCalledWith({
      endpoint: "https://s3.example.com",
      region: "eu-west-1",
      access_key_id: "ak",
      secret_key: "sk",
      bucket: "bucket",
      key: "file.txt",
    });
    expect(parseToolResult(result)).toEqual({ ok: true });
  });

  it("decodes base64 payloads for direct binary upload", async () => {
    const uploadBinary = vi.fn().mockResolvedValue({ uploaded: true });
    const server = createServerDouble();
    const runtime = {
      getClientSelectorSchema: () => undefined,
      getStorageSdkClient: vi.fn().mockReturnValue({
        storage: {
          file: { uploadBinary },
        },
      }),
      resolveClientName: vi.fn().mockReturnValue("primary"),
    };

    registerStorageTools(server as never, runtime as never);

    const tool = server.tools.get("storage_file_upload_binary");
    const result = await tool?.callback({
      body_base64: Buffer.from("hello").toString("base64"),
      file_id: "file_123",
    });

    expect(uploadBinary).toHaveBeenCalledTimes(1);
    const [, body] = uploadBinary.mock.calls[0] as [string, Uint8Array];
    expect(Buffer.from(body).toString("utf8")).toBe("hello");
    expect(parseToolResult(result)).toEqual({ uploaded: true });
  });

  it("rejects ambiguous direct binary upload bodies", async () => {
    const uploadBinary = vi.fn();
    const server = createServerDouble();
    const runtime = {
      getClientSelectorSchema: () => undefined,
      getStorageSdkClient: vi.fn().mockReturnValue({
        storage: {
          file: { uploadBinary },
        },
      }),
      resolveClientName: vi.fn().mockReturnValue("primary"),
    };

    registerStorageTools(server as never, runtime as never);

    const tool = server.tools.get("storage_file_upload_binary");

    const result = await tool?.callback({
      body_base64: Buffer.from("hello").toString("base64"),
      body_text: "hello",
      file_id: "file_123",
    });
    // Our wrapper catches validation errors and returns proper MCP error result (never throws)
    expect((result as any)?.isError).toBe(true);
    expect(String((result as any)?.content?.[0]?.text || "")).toContain(
      "Provide exactly one of `body_base64` or `body_text` for storage_file_upload_binary.",
    );
    expect(uploadBinary).not.toHaveBeenCalled();
  });

  it("summarizes proxied text responses", async () => {
    const proxy = vi.fn().mockResolvedValue(
      new Response("hello world", {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-test": "1",
        },
        status: 200,
        statusText: "OK",
      }),
    );
    const server = createServerDouble();
    const runtime = {
      getClientSelectorSchema: () => undefined,
      getStorageSdkClient: vi.fn().mockReturnValue({
        storage: {
          file: { proxy },
        },
      }),
      resolveClientName: vi.fn().mockReturnValue("primary"),
    };

    registerStorageTools(server as never, runtime as never);

    const tool = server.tools.get("storage_file_proxy");
    const result = await tool?.callback({
      file_id: "file_123",
      query: { purpose: "download" },
    });

    expect(proxy).toHaveBeenCalledWith("file_123", { purpose: "download" });
    expect(parseToolResult(result)).toEqual({
      bodyText: "hello world",
      contentType: "text/plain; charset=utf-8",
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-test": "1",
      },
      ok: true,
      status: 200,
      statusText: "OK",
    });
  });
});
