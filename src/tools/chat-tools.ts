import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "../responses.js";
import type { AthenaRuntime } from "../runtime.js";
import { readOnlyToolError } from "../runtime.js";
import { registerTool } from "../tooling.js";

/**
 * Athena Chat (real-time + persistent rooms/messages) tools backed by the SDK.
 *
 * These provide first-class access to Athena's chat subsystem:
 * - Room management (list, create, archive)
 * - Messaging (list, send, search)
 * - Realtime metadata (websocket connection info)
 *
 * All tools respect the MCP client's configured Athena client (via X-Athena-Client).
 * Write operations are blocked under READ_ONLY mode.
 */

const roomCreateSchema = {
  slug: z.string().min(1).describe("Unique slug/identifier for the room (used in URLs and references)"),
  name: z.string().optional().describe("Human readable display name"),
  metadata: z.record(z.string(), z.unknown()).optional().describe("Arbitrary JSON metadata for the room"),
  is_private: z.boolean().optional().describe("Whether the room is private (invitation only)"),
};

const messageSendSchema = {
  room_id: z.string().describe("Room identifier (ID or slug) to post the message into"),
  content: z.string().describe("Plain text or markdown message body"),
  metadata: z.record(z.string(), z.unknown()).optional().describe("Optional metadata for the message (reactions, attachments, etc.)"),
};

const listRoomsSchema = {
  limit: z.number().int().positive().max(200).optional().describe("Maximum rooms to return (default server limit usually 50)"),
  include_archived: z.boolean().optional().describe("Include archived rooms"),
};

const listMessagesSchema = {
  room_id: z.string().describe("Room to fetch messages for"),
  limit: z.number().int().positive().optional().describe("Max messages (default ~50)"),
  before_id: z.string().optional().describe("Pagination cursor - fetch messages before this ID"),
};

export function registerChatTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  registerTool(server, runtime, {
    description:
      "List available chat rooms using the Athena Chat SDK module. " +
      "Supports pagination and optionally archived rooms. " +
      "Returns room list with metadata.",
    name: "chat_list_rooms",
    shape: listRoomsSchema,
    handler: async ({ clientName, runtime }, input) => {
      try {
        const res = await runtime.performChat(clientName, "room", "list", input);
        return jsonContent(res ?? { rooms: [] });
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Create a new chat room. " +
      "Requires a unique slug. Blocked when READ_ONLY=true.",
    name: "chat_create_room",
    shape: roomCreateSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("chat_create_room");
      try {
        const res = await runtime.performChat(clientName, "room", "create", input);
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Fetch a single chat room by ID or slug, including current metadata and membership info when available.",
    name: "chat_get_room",
    shape: { room_id: z.string().describe("Room ID or slug") },
    handler: async ({ clientName, runtime }, { room_id }) => {
      try {
        const res = await runtime.performChat(clientName, "room", "get", { room_id });
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Archive (soft-delete / hide) a chat room. Blocked in read-only mode.",
    name: "chat_archive_room",
    shape: { room_id: z.string().describe("Room to archive") },
    handler: async ({ clientName, runtime }, { room_id }) => {
      if (runtime.config.readOnly) return readOnlyToolError("chat_archive_room");
      try {
        const res = await runtime.performChat(clientName, "room", "archive", { room_id });
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Fetch messages for a given room. Supports cursor-based pagination via before_id. " +
      "Returns messages in reverse chronological order (newest first) by default.",
    name: "chat_list_messages",
    shape: listMessagesSchema,
    handler: async ({ clientName, runtime }, input) => {
      try {
        const res = await runtime.performChat(clientName, "message", "list", input);
        return jsonContent(res ?? { messages: [] });
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Post a new message into a chat room. " +
      "Blocked when READ_ONLY=true. Supports optional metadata (for attachments, formatting hints, etc.).",
    name: "chat_send_message",
    shape: messageSendSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("chat_send_message");
      try {
        const res = await runtime.performChat(clientName, "message", "send", input);
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Return connection / contract metadata for the Athena chat realtime (WebSocket) gateway. " +
      "Useful for agents that want to establish live subscriptions.",
    name: "chat_get_realtime_info",
    handler: async ({ clientName, runtime }) => {
      try {
        const chat = runtime.getChatModule(clientName);
        const rt = chat?.realtime;
        const info = typeof rt === "function" ? await rt() : rt || (await runtime.sdkRequest(clientName, { service: "chat", path: "/realtime" }));
        return jsonContent(info ?? { note: "Realtime info returned by SDK or /chat/realtime contract" });
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Search across chat messages (full-text or metadata search). " +
      "Optional room scoping.",
    name: "chat_search_messages",
    shape: {
      query: z.string().min(1).describe("Search query string"),
      room_id: z.string().optional().describe("Limit search to a specific room"),
      limit: z.number().int().positive().optional(),
    },
    handler: async ({ clientName, runtime }, input) => {
      try {
        const res = await runtime.sdkRequest(clientName, {
          service: "chat",
          method: "GET",
          path: "/messages/search",
          body: input,
        });
        return jsonContent(res ?? []);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });
}
