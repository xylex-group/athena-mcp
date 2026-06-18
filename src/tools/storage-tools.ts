import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "../responses.js";
import { stringRecordSchema } from "../schemas.js";
import type { AthenaRuntime } from "../runtime.js";
import { registerTool } from "../tooling.js";

interface StorageModuleLike {
  createStorageCatalog(input: Record<string, unknown>): Promise<unknown>;
  createStorageUploadUrl(input: Record<string, unknown>): Promise<unknown>;
  createStorageUploadUrls(input: Record<string, unknown>): Promise<unknown>;
  deleteStorageCatalog(id: string): Promise<unknown>;
  deleteStorageFile(fileId: string): Promise<unknown>;
  deleteStorageFolder(input: Record<string, unknown>): Promise<unknown>;
  getStorageFile(fileId: string): Promise<unknown>;
  getStorageFileUrl(
    fileId: string,
    query?: Record<string, unknown>,
  ): Promise<unknown>;
  listStorageCatalogs(): Promise<unknown>;
  listStorageCredentials(): Promise<unknown>;
  listStorageFiles(input: Record<string, unknown>): Promise<unknown>;
  moveStorageFolder(input: Record<string, unknown>): Promise<unknown>;
  setStorageFileVisibility(
    fileId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  updateStorageCatalog(
    id: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  updateStorageFile(
    fileId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}

function getStorageModule(
  runtime: AthenaRuntime,
  clientName: string,
): StorageModuleLike {
  const client = runtime.getStorageSdkClient(clientName);
  const storage = client.storage;
  if (!storage || typeof storage !== "object") {
    throw new Error(
      "Athena storage module is unavailable. Ensure the SDK storage backend is enabled for this client.",
    );
  }
  return storage as StorageModuleLike;
}

export function registerStorageTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  registerTool(server, runtime, {
    description:
      "List managed Athena storage credentials using the storage SDK binding.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await getStorageModule(runtime, clientName).listStorageCredentials()),
    name: "storage_credentials_list",
  });

  registerTool(server, runtime, {
    description: "List managed Athena storage catalogs.",
    handler: async ({ clientName, runtime }) =>
      jsonContent(await getStorageModule(runtime, clientName).listStorageCatalogs()),
    name: "storage_catalog_list",
  });

  registerTool(server, runtime, {
    description: "Create a managed Athena storage catalog.",
    name: "storage_catalog_create",
    shape: {
      input: stringRecordSchema.describe("CreateStorageCatalogRequest payload"),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).createStorageCatalog(input),
      ),
  });

  registerTool(server, runtime, {
    description: "Update a managed Athena storage catalog.",
    name: "storage_catalog_update",
    shape: {
      id: z.string().describe("Storage catalog ID"),
      input: stringRecordSchema.describe("UpdateStorageCatalogRequest payload"),
    },
    handler: async ({ clientName, runtime }, { id, input }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).updateStorageCatalog(id, input),
      ),
  });

  registerTool(server, runtime, {
    description: "Delete a managed Athena storage catalog.",
    name: "storage_catalog_delete",
    shape: {
      id: z.string().describe("Storage catalog ID"),
    },
    handler: async ({ clientName, runtime }, { id }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).deleteStorageCatalog(id),
      ),
  });

  registerTool(server, runtime, {
    description: "Create an upload URL for a managed Athena storage file.",
    name: "storage_file_upload",
    shape: {
      input: stringRecordSchema.describe("CreateStorageUploadUrlRequest payload"),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).createStorageUploadUrl(input),
      ),
  });

  registerTool(server, runtime, {
    description:
      "Create multiple upload URLs for managed Athena storage files in one call.",
    name: "storage_file_upload_many",
    shape: {
      input: stringRecordSchema.describe("CreateStorageUploadUrlsRequest payload"),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).createStorageUploadUrls(input),
      ),
  });

  registerTool(server, runtime, {
    description: "List managed Athena storage files.",
    name: "storage_file_list",
    shape: {
      input: stringRecordSchema.describe("ListStorageFilesRequest payload"),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(await getStorageModule(runtime, clientName).listStorageFiles(input)),
  });

  registerTool(server, runtime, {
    description: "Get managed Athena storage file metadata.",
    name: "storage_file_get",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
    },
    handler: async ({ clientName, runtime }, { file_id }) =>
      jsonContent(await getStorageModule(runtime, clientName).getStorageFile(file_id)),
  });

  registerTool(server, runtime, {
    description: "Update managed Athena storage file metadata.",
    name: "storage_file_update",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      input: stringRecordSchema.describe("UpdateStorageFileRequest payload"),
    },
    handler: async ({ clientName, runtime }, { file_id, input }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).updateStorageFile(
          file_id,
          input,
        ),
      ),
  });

  registerTool(server, runtime, {
    description: "Delete a managed Athena storage file.",
    name: "storage_file_delete",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
    },
    handler: async ({ clientName, runtime }, { file_id }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).deleteStorageFile(file_id),
      ),
  });

  registerTool(server, runtime, {
    description: "Generate a signed URL for a managed Athena storage file.",
    name: "storage_file_url",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      query: stringRecordSchema
        .optional()
        .describe("Optional GetStorageFileUrlQuery payload"),
    },
    handler: async ({ clientName, runtime }, { file_id, query }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).getStorageFileUrl(
          file_id,
          query,
        ),
      ),
  });

  registerTool(server, runtime, {
    description:
      "Proxy a managed Athena storage file and return response metadata plus text when the proxied content is text-based.",
    name: "storage_file_proxy",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      query: stringRecordSchema
        .optional()
        .describe("Optional GetStorageFileUrlQuery payload"),
    },
    handler: async ({ clientName, runtime }, { file_id, query }) => {
      const queryString = query
        ? `?${new URLSearchParams(
            Object.entries(query).flatMap(([key, value]) =>
              value == null ? [] : [[key, String(value)]],
            ),
          ).toString()}`
        : "";
      return jsonContent(
        await runtime.apiFetchBinary(
          `/storage/files/${encodeURIComponent(file_id)}/proxy${queryString}`,
          clientName,
        ),
      );
    },
  });

  registerTool(server, runtime, {
    description:
      "PATCH-style visibility update for a managed Athena storage file.",
    name: "storage_file_visibility_update",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      input: stringRecordSchema.describe("SetStorageFileVisibilityRequest payload"),
    },
    handler: async ({ clientName, runtime }, { file_id, input }) =>
      jsonContent(
        await runtime.apiFetch(
          `/storage/files/${encodeURIComponent(file_id)}/visibility`,
          clientName,
          {
            body: input,
            method: "PATCH",
          },
        ),
      ),
  });

  registerTool(server, runtime, {
    description:
      "POST-style visibility update for a managed Athena storage file.",
    name: "storage_file_visibility_set",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      input: stringRecordSchema.describe("SetStorageFileVisibilityRequest payload"),
    },
    handler: async ({ clientName, runtime }, { file_id, input }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).setStorageFileVisibility(
          file_id,
          input,
        ),
      ),
  });

  registerTool(server, runtime, {
    description: "Delete a managed Athena storage folder.",
    name: "storage_folder_delete",
    shape: {
      input: stringRecordSchema.describe("DeleteStorageFolderRequest payload"),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).deleteStorageFolder(input),
      ),
  });

  registerTool(server, runtime, {
    description: "Move a managed Athena storage folder.",
    name: "storage_folder_move",
    shape: {
      input: stringRecordSchema.describe("MoveStorageFolderRequest payload"),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await getStorageModule(runtime, clientName).moveStorageFolder(input),
      ),
  });

  registerTool(server, runtime, {
    description: "List raw S3-compatible objects through Athena storage.",
    name: "storage_object_list",
    shape: {
      input: stringRecordSchema.describe("Request payload for POST /storage/objects"),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/objects", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Read object metadata with the raw S3-compatible storage binding.",
    name: "storage_object_head",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/objects/head",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/objects/head", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Update object metadata or state with the raw storage binding.",
    name: "storage_object_update",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/objects/update",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/objects/update", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Create a signed URL for a raw storage object.",
    name: "storage_object_url",
    shape: {
      input: stringRecordSchema.describe("Request payload for POST /storage/objects/url"),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/objects/url", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Delete a raw storage object.",
    name: "storage_object_delete",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/objects/delete",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/objects/delete", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Create an upload URL for a raw storage object.",
    name: "storage_object_upload_url",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/objects/upload-url",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/objects/upload-url", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Create a folder in the raw S3-compatible object namespace.",
    name: "storage_object_folder_create",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/objects/folder",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/objects/folder", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Delete a folder in the raw S3-compatible object namespace.",
    name: "storage_object_folder_delete",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/objects/folder/delete",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/objects/folder/delete", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Rename a folder in the raw S3-compatible object namespace.",
    name: "storage_object_folder_rename",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/objects/folder/rename",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/objects/folder/rename", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "List buckets visible to the Athena storage binding.",
    name: "storage_bucket_list",
    shape: {
      input: stringRecordSchema
        .optional()
        .describe("Optional request payload for POST /storage/buckets/list"),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/buckets/list", clientName, {
          body: input ?? {},
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Create a bucket through the Athena storage binding.",
    name: "storage_bucket_create",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/buckets/create",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/buckets/create", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Delete a bucket through the Athena storage binding.",
    name: "storage_bucket_delete",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/buckets/delete",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/buckets/delete", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Read bucket CORS configuration.",
    name: "storage_bucket_cors_get",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/buckets/cors",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/buckets/cors", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Set bucket CORS configuration.",
    name: "storage_bucket_cors_set",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/buckets/cors/set",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/buckets/cors/set", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });

  registerTool(server, runtime, {
    description: "Delete bucket CORS configuration.",
    name: "storage_bucket_cors_delete",
    shape: {
      input: stringRecordSchema.describe(
        "Request payload for POST /storage/buckets/cors/delete",
      ),
    },
    handler: async ({ clientName, runtime }, { input }) =>
      jsonContent(
        await runtime.apiFetch("/storage/buckets/cors/delete", clientName, {
          body: input,
          method: "POST",
        }),
      ),
  });
}
