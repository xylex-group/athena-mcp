import type { AthenaSdkClientWithStorage } from "@xylex-group/athena";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "../responses.js";
import { stringRecordSchema } from "../schemas.js";
import type { AthenaRuntime, BinarySummary } from "../runtime.js";
import { registerTool } from "../tooling.js";



type StorageModule = NonNullable<AthenaSdkClientWithStorage<false>["storage"]>;
type StorageInput<TShape extends z.ZodRawShape> = z.output<z.ZodObject<TShape>>;

interface StorageToolBase {
  description: string;
  name: string;
}

interface StorageToolWithoutShape extends StorageToolBase {
  run(storage: StorageModule): Promise<unknown>;
  shape?: undefined;
}

interface StorageToolWithShape<TShape extends z.ZodRawShape>
  extends StorageToolBase {
  run(storage: StorageModule, input: StorageInput<TShape>): Promise<unknown>;
  shape: TShape;
}

const genericStorageInputSchema = stringRecordSchema.describe(
  "Opaque request payload forwarded to Athena storage",
);
const optionalGenericStorageInputSchema = stringRecordSchema
  .optional()
  .describe("Optional opaque request payload forwarded to Athena storage");
const storageFileQuerySchema = stringRecordSchema
  .optional()
  .describe("Optional GetStorageFileUrlQuery payload");

function hasShape<TShape extends z.ZodRawShape>(
  definition: StorageToolWithoutShape | StorageToolWithShape<TShape>,
): definition is StorageToolWithShape<TShape> {
  return definition.shape !== undefined;
}

function getStorageModule(
  runtime: AthenaRuntime,
  clientName: string,
): StorageModule {
  const client = runtime.getStorageSdkClient(clientName);
  const storage = client.storage;
  if (!storage || typeof storage !== "object") {
    throw new Error(
      "Athena storage module is unavailable. Ensure the SDK storage backend is enabled for this client.",
    );
  }
  return storage;
}

function registerStorageTool(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: StorageToolWithoutShape,
): void;

function registerStorageTool<TShape extends z.ZodRawShape>(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: StorageToolWithShape<TShape>,
): void;

function registerStorageTool<TShape extends z.ZodRawShape>(
  server: McpServer,
  runtime: AthenaRuntime,
  definition: StorageToolWithoutShape | StorageToolWithShape<TShape>,
): void {
  if (hasShape(definition)) {
    registerTool(server, runtime, {
      description: definition.description,
      name: definition.name,
      shape: definition.shape,
      handler: async ({ clientName, runtime }, input) =>
        jsonContent(
          await definition.run(getStorageModule(runtime, clientName), input),
        ),
    });
    return;
  }

  registerTool(server, runtime, {
    description: definition.description,
    name: definition.name,
    handler: async ({ clientName, runtime }) =>
      jsonContent(await definition.run(getStorageModule(runtime, clientName))),
  });
}

function decodeBinaryBody(input: {
  body_base64?: string;
  body_text?: string;
}): Uint8Array {
  const hasBase64 = input.body_base64 !== undefined;
  const hasText = input.body_text !== undefined;

  if (hasBase64 === hasText) {
    throw new Error(
      "Provide exactly one of `body_base64` or `body_text` for storage_file_upload_binary.",
    );
  }

  if (hasBase64) {
    return Buffer.from(input.body_base64 ?? "", "base64");
  }

  return Buffer.from(input.body_text ?? "", "utf8");
}

function asStorageInput<T>(input: Record<string, unknown>): T {
  return input as T;
}

function asOptionalStorageInput<T>(
  input?: Record<string, unknown>,
): T | undefined {
  return input as T | undefined;
}

async function summarizeBinaryResponse(response: Response): Promise<BinarySummary> {
  const contentType = response.headers.get("content-type") ?? undefined;
  const bodyText =
    contentType && /json|text|xml|yaml|javascript|html/i.test(contentType)
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

export function registerStorageTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  registerStorageTool(server, runtime, {
    description:
      "List managed Athena storage credentials using the storage SDK binding.",
    name: "storage_credentials_list",
    run: async (storage) => storage.credentials.list(),
  });

  registerStorageTool(server, runtime, {
    description: "List managed Athena storage catalogs.",
    name: "storage_catalog_list",
    run: async (storage) => storage.catalog.list(),
  });

  registerStorageTool(server, runtime, {
    description: "Create a managed Athena storage catalog.",
    name: "storage_catalog_create",
    shape: {
      input: genericStorageInputSchema.describe("CreateStorageCatalogRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.catalog.create(
        asStorageInput<Parameters<StorageModule["catalog"]["create"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Update a managed Athena storage catalog.",
    name: "storage_catalog_update",
    shape: {
      id: z.string().describe("Storage catalog ID"),
      input: genericStorageInputSchema.describe("UpdateStorageCatalogRequest payload"),
    },
    run: async (storage, { id, input }) => storage.catalog.update(id, input),
  });

  registerStorageTool(server, runtime, {
    description: "Delete a managed Athena storage catalog.",
    name: "storage_catalog_delete",
    shape: {
      id: z.string().describe("Storage catalog ID"),
    },
    run: async (storage, { id }) => storage.catalog.delete(id),
  });

  registerStorageTool(server, runtime, {
    description: "Create an upload URL for a managed Athena storage file.",
    name: "storage_file_upload",
    shape: {
      input: genericStorageInputSchema.describe("CreateStorageUploadUrlRequest payload"),
    },
    run: async (storage, { input }) => storage.file.upload(input),
  });

  registerStorageTool(server, runtime, {
    description:
      "Create multiple upload URLs for managed Athena storage files in one call.",
    name: "storage_file_upload_many",
    shape: {
      input: genericStorageInputSchema.describe("CreateStorageUploadUrlsRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.file.uploadMany(
        asStorageInput<Parameters<StorageModule["file"]["uploadMany"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description:
      "Confirm that a managed Athena storage upload completed and persist any final metadata.",
    name: "storage_file_confirm_upload",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      input: optionalGenericStorageInputSchema.describe(
        "Optional ConfirmStorageUploadRequest payload",
      ),
    },
    run: async (storage, { file_id, input }) =>
      storage.file.confirmUpload(
        file_id,
        asOptionalStorageInput<
          Parameters<StorageModule["file"]["confirmUpload"]>[1]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description:
      "Upload small file content directly through MCP using either base64 or UTF-8 text.",
    name: "storage_file_upload_binary",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      body_base64: z
        .string()
        .optional()
        .describe("Base64-encoded file contents. Provide this or `body_text`."),
      body_text: z
        .string()
        .optional()
        .describe("UTF-8 file contents. Provide this or `body_base64`."),
    },
    run: async (storage, input) =>
      storage.file.uploadBinary(input.file_id, decodeBinaryBody(input)),
  });

  registerStorageTool(server, runtime, {
    description: "List managed Athena storage files.",
    name: "storage_file_list",
    shape: {
      input: genericStorageInputSchema.describe("ListStorageFilesRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.file.list(
        asStorageInput<Parameters<StorageModule["file"]["list"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Search managed Athena storage files.",
    name: "storage_file_search",
    shape: {
      input: genericStorageInputSchema.describe("SearchStorageFilesRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.file.search(
        asStorageInput<Parameters<StorageModule["file"]["search"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Get managed Athena storage file metadata.",
    name: "storage_file_get",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
    },
    run: async (storage, { file_id }) => storage.file.get(file_id),
  });

  registerStorageTool(server, runtime, {
    description: "Update managed Athena storage file metadata.",
    name: "storage_file_update",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      input: genericStorageInputSchema.describe("UpdateStorageFileRequest payload"),
    },
    run: async (storage, { file_id, input }) =>
      storage.file.update(
        file_id,
        asStorageInput<Parameters<StorageModule["file"]["update"]>[1]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Update many managed Athena storage files in one call.",
    name: "storage_file_update_many",
    shape: {
      input: genericStorageInputSchema.describe("UpdateManyStorageFilesRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.file.updateMany(
        asStorageInput<Parameters<StorageModule["file"]["updateMany"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete a managed Athena storage file.",
    name: "storage_file_delete",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
    },
    run: async (storage, { file_id }) => storage.file.delete(file_id),
  });

  registerStorageTool(server, runtime, {
    description: "Delete many managed Athena storage files in one call.",
    name: "storage_file_delete_many",
    shape: {
      input: genericStorageInputSchema.describe("DeleteManyStorageFilesRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.file.deleteMany(
        asStorageInput<Parameters<StorageModule["file"]["deleteMany"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Restore a soft-deleted managed Athena storage file.",
    name: "storage_file_restore",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
    },
    run: async (storage, { file_id }) => storage.file.restore(file_id),
  });

  registerStorageTool(server, runtime, {
    description: "Purge a managed Athena storage file permanently.",
    name: "storage_file_purge",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
    },
    run: async (storage, { file_id }) => storage.file.purge(file_id),
  });

  registerStorageTool(server, runtime, {
    description: "Copy a managed Athena storage file.",
    name: "storage_file_copy",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      input: genericStorageInputSchema.describe("CopyStorageFileRequest payload"),
    },
    run: async (storage, { file_id, input }) =>
      storage.file.copy(
        file_id,
        asStorageInput<Parameters<StorageModule["file"]["copy"]>[1]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Generate a signed URL for a managed Athena storage file.",
    name: "storage_file_url",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      query: storageFileQuerySchema,
    },
    run: async (storage, { file_id, query }) =>
      storage.file.url(
        file_id,
        asOptionalStorageInput<Parameters<StorageModule["file"]["url"]>[1]>(query),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Generate the public URL for a managed Athena storage file.",
    name: "storage_file_public_url",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
    },
    run: async (storage, { file_id }) => storage.file.publicUrl(file_id),
  });

  registerStorageTool(server, runtime, {
    description: "Generate the proxy URL for a managed Athena storage file.",
    name: "storage_file_proxy_url",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      query: storageFileQuerySchema,
    },
    run: async (storage, { file_id, query }) =>
      storage.file.proxyUrl(
        file_id,
        asOptionalStorageInput<
          Parameters<StorageModule["file"]["proxyUrl"]>[1]
        >(query),
      ),
  });

  registerStorageTool(server, runtime, {
    description:
      "Proxy a managed Athena storage file and return response metadata plus text when the proxied content is text-based.",
    name: "storage_file_proxy",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      query: storageFileQuerySchema,
    },
    run: async (storage, { file_id, query }) =>
      summarizeBinaryResponse(
        await storage.file.proxy(
          file_id,
          asOptionalStorageInput<Parameters<StorageModule["file"]["proxy"]>[1]>(
            query,
          ),
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description:
      "PATCH-style visibility update for a managed Athena storage file.",
    name: "storage_file_visibility_update",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      input: genericStorageInputSchema.describe("SetStorageFileVisibilityRequest payload"),
    },
    run: async (storage, { file_id, input }) =>
      storage.file.visibility.update(
        file_id,
        asStorageInput<
          Parameters<StorageModule["file"]["visibility"]["update"]>[1]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description:
      "POST-style visibility update for a managed Athena storage file.",
    name: "storage_file_visibility_set",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      input: genericStorageInputSchema.describe("SetStorageFileVisibilityRequest payload"),
    },
    run: async (storage, { file_id, input }) =>
      storage.file.visibility.set(
        file_id,
        asStorageInput<Parameters<StorageModule["file"]["visibility"]["set"]>[1]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description:
      "Update visibility for many managed Athena storage files in one call.",
    name: "storage_file_visibility_set_many",
    shape: {
      input: genericStorageInputSchema.describe(
        "SetManyStorageFileVisibilityRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.file.visibility.setMany(
        asStorageInput<
          Parameters<StorageModule["file"]["visibility"]["setMany"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "List managed Athena storage file versions.",
    name: "storage_file_versions",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
    },
    run: async (storage, { file_id }) => storage.file.versions(file_id),
  });

  registerStorageTool(server, runtime, {
    description: "Restore a specific managed Athena storage file version.",
    name: "storage_file_version_restore",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      version_id: z.string().describe("Managed storage file version ID"),
    },
    run: async (storage, { file_id, version_id }) =>
      storage.file.restoreVersion(file_id, version_id),
  });

  registerStorageTool(server, runtime, {
    description: "Delete a specific managed Athena storage file version.",
    name: "storage_file_version_delete",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      version_id: z.string().describe("Managed storage file version ID"),
    },
    run: async (storage, { file_id, version_id }) =>
      storage.file.deleteVersion(file_id, version_id),
  });

  registerStorageTool(server, runtime, {
    description: "Read retention settings for a managed Athena storage file.",
    name: "storage_file_retention_get",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      query: optionalGenericStorageInputSchema.describe(
        "Optional StorageFileRetentionRequest subset containing `version_id`",
      ),
    },
    run: async (storage, { file_id, query }) =>
      storage.file.retention.get(
        file_id,
        asOptionalStorageInput<
          Parameters<StorageModule["file"]["retention"]["get"]>[1]
        >(query),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Set retention settings for a managed Athena storage file.",
    name: "storage_file_retention_set",
    shape: {
      file_id: z.string().describe("Managed storage file ID"),
      input: genericStorageInputSchema.describe("StorageFileRetentionRequest payload"),
    },
    run: async (storage, { file_id, input }) =>
      storage.file.retention.set(
        file_id,
        asStorageInput<
          Parameters<StorageModule["file"]["retention"]["set"]>[1]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "List managed Athena storage folders under a prefix.",
    name: "storage_folder_list",
    shape: {
      input: genericStorageInputSchema.describe("ListStorageFoldersRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.folder.list(
        asStorageInput<Parameters<StorageModule["folder"]["list"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Return the managed Athena storage folder tree under a prefix.",
    name: "storage_folder_tree",
    shape: {
      input: genericStorageInputSchema.describe("TreeStorageFoldersRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.folder.tree(
        asStorageInput<Parameters<StorageModule["folder"]["tree"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete a managed Athena storage folder.",
    name: "storage_folder_delete",
    shape: {
      input: genericStorageInputSchema.describe("DeleteStorageFolderRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.folder.delete(
        asStorageInput<Parameters<StorageModule["folder"]["delete"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Move a managed Athena storage folder.",
    name: "storage_folder_move",
    shape: {
      input: genericStorageInputSchema.describe("MoveStorageFolderRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.folder.move(
        asStorageInput<Parameters<StorageModule["folder"]["move"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "List file-level permissions for a managed Athena storage file.",
    name: "storage_permission_list",
    shape: {
      input: genericStorageInputSchema.describe("StoragePermissionListRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.permission.list(
        asStorageInput<Parameters<StorageModule["permission"]["list"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Grant a permission for a managed Athena storage file.",
    name: "storage_permission_grant",
    shape: {
      input: genericStorageInputSchema.describe("StoragePermissionGrantRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.permission.grant(
        asStorageInput<Parameters<StorageModule["permission"]["grant"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Revoke a permission for a managed Athena storage file.",
    name: "storage_permission_revoke",
    shape: {
      input: genericStorageInputSchema.describe("StoragePermissionRevokeRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.permission.revoke(
        asStorageInput<Parameters<StorageModule["permission"]["revoke"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Check a permission for a managed Athena storage file.",
    name: "storage_permission_check",
    shape: {
      input: genericStorageInputSchema.describe("StoragePermissionCheckRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.permission.check(
        asStorageInput<Parameters<StorageModule["permission"]["check"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "List raw S3-compatible objects through Athena storage.",
    name: "storage_object_list",
    shape: {
      input: genericStorageInputSchema.describe("StorageListObjectsRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.list(
        asStorageInput<Parameters<StorageModule["object"]["list"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Read object metadata with the raw S3-compatible storage binding.",
    name: "storage_object_head",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.head(
        asStorageInput<Parameters<StorageModule["object"]["head"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Check whether a raw storage object exists.",
    name: "storage_object_exists",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.exists(
        asStorageInput<Parameters<StorageModule["object"]["exists"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Validate a raw storage object checksum or ETag.",
    name: "storage_object_validate",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectValidateRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.validate(
        asStorageInput<Parameters<StorageModule["object"]["validate"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Update object metadata or state with the raw storage binding.",
    name: "storage_object_update",
    shape: {
      input: genericStorageInputSchema.describe("StorageUpdateObjectRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.update(
        asStorageInput<Parameters<StorageModule["object"]["update"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Copy a raw storage object.",
    name: "storage_object_copy",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectCopyRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.copy(
        asStorageInput<Parameters<StorageModule["object"]["copy"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Create a signed URL for a raw storage object.",
    name: "storage_object_url",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.url(
        asStorageInput<Parameters<StorageModule["object"]["url"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Create a public URL for a raw storage object.",
    name: "storage_object_public_url",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectPublicUrlRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.publicUrl(
        asStorageInput<Parameters<StorageModule["object"]["publicUrl"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete a raw storage object.",
    name: "storage_object_delete",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.delete(
        asStorageInput<Parameters<StorageModule["object"]["delete"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Create an upload URL for a raw storage object.",
    name: "storage_object_upload_url",
    shape: {
      input: genericStorageInputSchema.describe("StoragePresignUploadRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.uploadUrl(
        asStorageInput<Parameters<StorageModule["object"]["uploadUrl"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "List versions for a raw storage object or prefix.",
    name: "storage_object_versions",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectVersionListRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.versions(
        asStorageInput<Parameters<StorageModule["object"]["versions"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Restore a specific raw storage object version.",
    name: "storage_object_version_restore",
    shape: {
      input: genericStorageInputSchema.describe(
        "StorageObjectVersionMutationRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.object.restoreVersion(
        asStorageInput<
          Parameters<StorageModule["object"]["restoreVersion"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete a specific raw storage object version.",
    name: "storage_object_version_delete",
    shape: {
      input: genericStorageInputSchema.describe(
        "StorageObjectVersionMutationRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.object.deleteVersion(
        asStorageInput<
          Parameters<StorageModule["object"]["deleteVersion"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Create a signed POST policy for a raw storage object upload.",
    name: "storage_object_post_policy",
    shape: {
      input: genericStorageInputSchema.describe("StorageSignedPostPolicyRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.object.postPolicy(
        asStorageInput<Parameters<StorageModule["object"]["postPolicy"]>[0]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Create a folder in the raw S3-compatible object namespace.",
    name: "storage_object_folder_create",
    shape: {
      input: genericStorageInputSchema.describe(
        "StorageObjectFolderCreateRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.object.folder.create(
        asStorageInput<
          Parameters<StorageModule["object"]["folder"]["create"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete a folder in the raw S3-compatible object namespace.",
    name: "storage_object_folder_delete",
    shape: {
      input: genericStorageInputSchema.describe(
        "StorageObjectFolderDeleteRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.object.folder.delete(
        asStorageInput<
          Parameters<StorageModule["object"]["folder"]["delete"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Rename a folder in the raw S3-compatible object namespace.",
    name: "storage_object_folder_rename",
    shape: {
      input: genericStorageInputSchema.describe(
        "StorageObjectFolderRenameRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.object.folder.rename(
        asStorageInput<
          Parameters<StorageModule["object"]["folder"]["rename"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "List buckets visible to the Athena storage binding.",
    name: "storage_bucket_list",
    shape: {
      input: optionalGenericStorageInputSchema.describe(
        "Optional StorageObjectBaseRequest payload without `bucket`",
      ),
    },
    run: async (storage, { input }) =>
      storage.bucket.list(
        (input ?? {}) as Parameters<StorageModule["bucket"]["list"]>[0],
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Create a bucket through the Athena storage binding.",
    name: "storage_bucket_create",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectBaseRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.create(
        asStorageInput<Parameters<StorageModule["bucket"]["create"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete a bucket through the Athena storage binding.",
    name: "storage_bucket_delete",
    shape: {
      input: genericStorageInputSchema.describe("StorageObjectBaseRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.delete(
        asStorageInput<Parameters<StorageModule["bucket"]["delete"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Read bucket CORS configuration.",
    name: "storage_bucket_cors_get",
    shape: {
      input: genericStorageInputSchema.describe("StorageBucketCorsRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.cors.get(
        asStorageInput<Parameters<StorageModule["bucket"]["cors"]["get"]>[0]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Set bucket CORS configuration.",
    name: "storage_bucket_cors_set",
    shape: {
      input: genericStorageInputSchema.describe("StorageSetBucketCorsRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.cors.set(
        asStorageInput<Parameters<StorageModule["bucket"]["cors"]["set"]>[0]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete bucket CORS configuration.",
    name: "storage_bucket_cors_delete",
    shape: {
      input: genericStorageInputSchema.describe("StorageBucketCorsRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.cors.delete(
        asStorageInput<Parameters<StorageModule["bucket"]["cors"]["delete"]>[0]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Read bucket lifecycle configuration.",
    name: "storage_bucket_lifecycle_get",
    shape: {
      input: genericStorageInputSchema.describe("StorageBucketLifecycleRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.lifecycle.get(
        asStorageInput<
          Parameters<StorageModule["bucket"]["lifecycle"]["get"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Set bucket lifecycle configuration.",
    name: "storage_bucket_lifecycle_set",
    shape: {
      input: genericStorageInputSchema.describe(
        "StorageSetBucketLifecycleRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.bucket.lifecycle.set(
        asStorageInput<
          Parameters<StorageModule["bucket"]["lifecycle"]["set"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete bucket lifecycle configuration.",
    name: "storage_bucket_lifecycle_delete",
    shape: {
      input: genericStorageInputSchema.describe("StorageBucketLifecycleRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.lifecycle.delete(
        asStorageInput<
          Parameters<StorageModule["bucket"]["lifecycle"]["delete"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Read bucket policy configuration.",
    name: "storage_bucket_policy_get",
    shape: {
      input: genericStorageInputSchema.describe("StorageBucketPolicyRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.policy.get(
        asStorageInput<Parameters<StorageModule["bucket"]["policy"]["get"]>[0]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Set bucket policy configuration.",
    name: "storage_bucket_policy_set",
    shape: {
      input: genericStorageInputSchema.describe("StorageSetBucketPolicyRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.policy.set(
        asStorageInput<Parameters<StorageModule["bucket"]["policy"]["set"]>[0]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete bucket policy configuration.",
    name: "storage_bucket_policy_delete",
    shape: {
      input: genericStorageInputSchema.describe("StorageBucketPolicyRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.bucket.policy.delete(
        asStorageInput<
          Parameters<StorageModule["bucket"]["policy"]["delete"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Read bucket public-access block configuration.",
    name: "storage_bucket_public_access_get",
    shape: {
      input: genericStorageInputSchema.describe(
        "StoragePublicAccessBlockRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.bucket.publicAccess.get(
        asStorageInput<
          Parameters<StorageModule["bucket"]["publicAccess"]["get"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Set bucket public-access block configuration.",
    name: "storage_bucket_public_access_set",
    shape: {
      input: genericStorageInputSchema.describe(
        "StorageSetPublicAccessBlockRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.bucket.publicAccess.set(
        asStorageInput<
          Parameters<StorageModule["bucket"]["publicAccess"]["set"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Delete bucket public-access block configuration.",
    name: "storage_bucket_public_access_delete",
    shape: {
      input: genericStorageInputSchema.describe(
        "StoragePublicAccessBlockRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.bucket.publicAccess.delete(
        asStorageInput<
          Parameters<StorageModule["bucket"]["publicAccess"]["delete"]>[0]
        >(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Create a multipart upload session for a managed storage file.",
    name: "storage_multipart_create",
    shape: {
      input: genericStorageInputSchema.describe("StorageMultipartCreateRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.multipart.create(
        asStorageInput<Parameters<StorageModule["multipart"]["create"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Sign a multipart upload part for a managed storage file.",
    name: "storage_multipart_sign_part",
    shape: {
      input: genericStorageInputSchema.describe("StorageMultipartSignPartRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.multipart.signPart(
        asStorageInput<Parameters<StorageModule["multipart"]["signPart"]>[0]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Complete a multipart upload for a managed storage file.",
    name: "storage_multipart_complete",
    shape: {
      input: genericStorageInputSchema.describe(
        "StorageMultipartCompleteRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.multipart.complete(
        asStorageInput<Parameters<StorageModule["multipart"]["complete"]>[0]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "Abort a multipart upload for a managed storage file.",
    name: "storage_multipart_abort",
    shape: {
      input: genericStorageInputSchema.describe("StorageMultipartAbortRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.multipart.abort(
        asStorageInput<Parameters<StorageModule["multipart"]["abort"]>[0]>(input),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "List parts for a multipart upload on a managed storage file.",
    name: "storage_multipart_list_parts",
    shape: {
      input: genericStorageInputSchema.describe(
        "StorageMultipartListPartsRequest payload",
      ),
    },
    run: async (storage, { input }) =>
      storage.multipart.listParts(
        asStorageInput<Parameters<StorageModule["multipart"]["listParts"]>[0]>(
          input,
        ),
      ),
  });

  registerStorageTool(server, runtime, {
    description: "List storage audit events.",
    name: "storage_audit_list",
    shape: {
      input: genericStorageInputSchema.describe("StorageAuditQueryRequest payload"),
    },
    run: async (storage, { input }) =>
      storage.audit.list(
        asStorageInput<Parameters<StorageModule["audit"]["list"]>[0]>(input),
      ),
  });
}
