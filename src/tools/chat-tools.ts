import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "../responses.js";
import type { AthenaRuntime } from "../runtime.js";
import { readOnlyToolError } from "../runtime.js";
import { registerTool } from "../tooling.js";

const roomCreateSchema = {
  slug: z.string().min(1).describe("Unique room slug"),
  name: z.string().optional().describe("Display name for the room"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  is_private: z.boolean().optional(),
};

const messageSendSchema = {
  room_id: z.string().describe("Target chat room ID or slug"),
  content: z.string().describe("Message text content"),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

const listRoomsSchema = {
  limit: z.number().int().positive().optional().describe("Max rooms to return"),
  include_archived: z.boolean().optional(),
};

const listMessagesSchema = {
  room_id: z.string(),
  limit: z.number().int().positive().optional(),
  before_id: z.string().optional(),
};

export function registerChatTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  registerTool(server, runtime, {
    description: "List chat rooms via the Athena chat SDK module.",
    name: "chat_list_rooms",
    shape: listRoomsSchema,
    handler: async ({ clientName, runtime }, input) => {
      const chat = runtime.getChatModule(clientName);
      const roomApi = chat.room;
      // SDK shape: room.list(...) or similar
      const res = await (roomApi as any).list ? (roomApi as any).list(input) : (chat as any).listRooms?.(input);
      return jsonContent(res ?? { rooms: [] });
    },
  });

  registerTool(server, runtime, {
    description: "Create a chat room. Blocked when read_only.",
    name: "chat_create_room",
    shape: roomCreateSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("chat_create_room");
      const chat = runtime.getChatModule(clientName);
      const res = await (chat.room as any).create(input);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Get details for a specific chat room.",
    name: "chat_get_room",
    shape: { room_id: z.string() },
    handler: async ({ clientName, runtime }, { room_id }) => {
      const chat = runtime.getChatModule(clientName);
      const res = await (chat.room as any).get ? (chat.room as any).get(room_id) : (chat as any).getRoom?.(room_id);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Archive a chat room. Blocked in read_only.",
    name: "chat_archive_room",
    shape: { room_id: z.string() },
    handler: async ({ clientName, runtime }, { room_id }) => {
      if (runtime.config.readOnly) return readOnlyToolError("chat_archive_room");
      const chat = runtime.getChatModule(clientName);
      const res = await (chat.room as any).archive ? (chat.room as any).archive(room_id) : (chat as any).archiveRoom?.(room_id);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "List messages in a chat room.",
    name: "chat_list_messages",
    shape: listMessagesSchema,
    handler: async ({ clientName, runtime }, input) => {
      const chat = runtime.getChatModule(clientName);
      const res = await (chat.message as any).list ? (chat.message as any).list(input) : (chat as any).listMessages?.(input);
      return jsonContent(res ?? { messages: [] });
    },
  });

  registerTool(server, runtime, {
    description: "Send a message to a chat room. Blocked in read_only.",
    name: "chat_send_message",
    shape: messageSendSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("chat_send_message");
      const chat = runtime.getChatModule(clientName);
      const res = await (chat.message as any).send ? (chat.message as any).send(input) : (chat as any).sendMessage?.(input);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Get realtime websocket info for chat (uses SDK chat.realtime).",
    name: "chat_get_realtime_info",
    handler: async ({ clientName, runtime }) => {
      const chat = runtime.getChatModule(clientName);
      const rt = chat.realtime;
      // May return connection metadata or be callable
      const info = typeof rt === "function" ? await rt() : rt;
      return jsonContent(info ?? { note: "chat realtime contract exposed via SDK" });
    },
  });

  // Additional chat surface
  registerTool(server, runtime, {
    description: "Search chat messages.",
    name: "chat_search_messages",
    shape: {
      query: z.string(),
      room_id: z.string().optional(),
      limit: z.number().int().positive().optional(),
    },
    handler: async ({ clientName, runtime }, input) => {
      const chat = runtime.getChatModule(clientName);
      const res = await (chat as any).searchMessages?.(input) || (chat.message as any).search?.(input);
      return jsonContent(res ?? []);
    },
  });
}
