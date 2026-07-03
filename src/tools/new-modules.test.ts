import { describe, expect, it } from "vitest";
import { registerAuthTools } from "./auth-tools.js";
import { registerChatTools } from "./chat-tools.js";
import { registerGatewayTools } from "./gateway-tools.js";
import { registerSdkDbTools } from "./sdk-db-tools.js";

interface RegisteredTool {
  callback: (...args: unknown[]) => Promise<unknown>;
  config: { description: string; inputSchema?: Record<string, unknown> };
  name: string;
}

function createServerDouble() {
  const tools = new Map<string, RegisteredTool>();
  return {
    tools,
    registerTool(name: string, config: any, callback: any) {
      tools.set(name, { callback, config, name });
    },
  };
}

describe("new SDK module tools registration", () => {
  const runtimeDouble = {
    config: { readOnly: false },
    getClientSelectorSchema: () => undefined,
    getAuthModule: () => ({}),
    getChatModule: () => ({ room: {}, message: {}, realtime: {} }),
    getDbModule: () => ({ from: () => ({}) }),
    getSdkClient: () => ({}),
    apiFetch: async () => ({}),
  } as any;

  it("registers auth tools without error", () => {
    const server = createServerDouble();
    registerAuthTools(server as any, runtimeDouble);
    const names = [...server.tools.keys()];
    expect(names).toEqual(expect.arrayContaining(["auth_get_session", "auth_sign_up", "auth_admin_list_users"]));
    expect(names.length).toBeGreaterThanOrEqual(10);
  });

  it("registers chat tools", () => {
    const server = createServerDouble();
    registerChatTools(server as any, runtimeDouble);
    const names = [...server.tools.keys()];
    expect(names).toEqual(expect.arrayContaining(["chat_list_rooms", "chat_send_message", "chat_get_realtime_info"]));
  });

  it("registers sdk db tools", () => {
    const server = createServerDouble();
    registerSdkDbTools(server as any, runtimeDouble);
    const names = [...server.tools.keys()];
    expect(names).toEqual(expect.arrayContaining(["sdk_db_select", "sdk_db_insert", "sdk_verify_connection"]));
  });

  it("registers gateway direct tools", () => {
    const server = createServerDouble();
    registerGatewayTools(server as any, runtimeDouble);
    const names = [...server.tools.keys()];
    expect(names).toEqual(expect.arrayContaining(["gateway_fetch", "gateway_insert", "gateway_sql", "management_capabilities"]));
  });
});
