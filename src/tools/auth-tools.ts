import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "../responses.js";
import type { AthenaRuntime } from "../runtime.js";
import { readOnlyToolError } from "../runtime.js";
import { registerTool } from "../tooling.js";

const optionalClientOnly = {
  // client handled by tooling
};

const signUpSchema = {
  email: z.string().email().describe("User email"),
  password: z.string().min(8).describe("User password"),
  // allow extra metadata as any for flexibility
  data: z.record(z.string(), z.unknown()).optional().describe("Optional user metadata"),
};

const signInSchema = {
  email: z.string().email().describe("User email"),
  password: z.string().describe("User password"),
};

const refreshTokenSchema = {
  refresh_token: z.string().describe("Refresh token"),
};

const adminCreateUserSchema = {
  email: z.string().email().describe("User email"),
  password: z.string().optional().describe("Optional password"),
  email_confirm: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
};

export function registerAuthTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  // Always-on read auth surface
  registerTool(server, runtime, {
    description: "Get current session using the Athena auth SDK binding (respects client routing).",
    name: "auth_get_session",
    handler: async ({ clientName, runtime }) => {
      const auth = runtime.getAuthModule(clientName);
      const res = await auth.getSession();
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Get current user using the Athena auth SDK binding.",
    name: "auth_get_user",
    handler: async ({ clientName, runtime }) => {
      const auth = runtime.getAuthModule(clientName);
      const res = await auth.getUser();
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Sign out the current session using the Athena auth SDK.",
    name: "auth_sign_out",
    handler: async ({ clientName, runtime }) => {
      const auth = runtime.getAuthModule(clientName);
      const res = await auth.signOut();
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Refresh access token using a refresh token.",
    name: "auth_refresh_token",
    shape: refreshTokenSchema,
    handler: async ({ clientName, runtime }, input) => {
      const auth = runtime.getAuthModule(clientName);
      const res = await auth.refreshToken(input.refresh_token);
      return jsonContent(res);
    },
  });

  // Write operations - blocked in read only
  registerTool(server, runtime, {
    description: "Sign up a new user via Athena auth. Blocked when read_only mode is enabled.",
    name: "auth_sign_up",
    shape: signUpSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_sign_up");
      const auth = runtime.getAuthModule(clientName);
      const res = await auth.signUp({
        email: input.email,
        password: input.password,
        data: input.data,
      } as any);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Sign in with email/password via Athena auth. Blocked when read_only mode is enabled.",
    name: "auth_sign_in",
    shape: signInSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_sign_in");
      const auth = runtime.getAuthModule(clientName);
      const res = await auth.signIn(input as any);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Send a password reset / forgot password email. Blocked in read_only.",
    name: "auth_forgot_password",
    shape: { email: z.string().email() },
    handler: async ({ clientName, runtime }, { email }) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_forgot_password");
      const auth = runtime.getAuthModule(clientName);
      const res = await auth.forgetPassword(email);
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Reset password using token. Blocked in read_only.",
    name: "auth_reset_password",
    shape: {
      token: z.string(),
      new_password: z.string().min(8),
    },
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_reset_password");
      const auth = runtime.getAuthModule(clientName);
      const res = await auth.resetPassword(input.new_password, input.token);
      return jsonContent(res);
    },
  });

  // Admin auth surface (may require elevated rights; registered always like other admin but docs note experimental nature)
  registerTool(server, runtime, {
    description: "Admin: list users (via auth admin). May require elevated admin key rights.",
    name: "auth_admin_list_users",
    handler: async ({ clientName, runtime }) => {
      const auth = runtime.getAuthModule(clientName);
      // auth.admin may exist
      const admin = (auth as any).admin;
      if (!admin || typeof admin.listUsers !== "function") {
        return jsonContent({ error: "auth.admin.listUsers not available on this client" });
      }
      const res = await admin.listUsers();
      return jsonContent(res);
    },
  });

  registerTool(server, runtime, {
    description: "Admin: create user. Blocked in read_only. May require elevated rights.",
    name: "auth_admin_create_user",
    shape: adminCreateUserSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_admin_create_user");
      const auth = runtime.getAuthModule(clientName);
      const admin = (auth as any).admin;
      if (!admin || typeof admin.createUser !== "function") {
        return jsonContent({ error: "auth.admin.createUser not available" });
      }
      const res = await admin.createUser(input as any);
      return jsonContent(res);
    },
  });
}
