import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "../responses.js";
import type { AthenaRuntime } from "../runtime.js";
import { readOnlyToolError } from "../runtime.js";
import { registerTool } from "../tooling.js";

/**
 * Athena Auth SDK surface exposed as individual MCP tools.
 *
 * These tools use the @xylex-group/athena SDK auth module when available
 * (preferred for typed flows) and fall back to the low-level unified request surface.
 *
 * All tools honor the MCP server's client routing (X-Athena-Client) and the
 * global READ_ONLY flag for mutating operations.
 *
 * Note: Some admin auth actions may require elevated privileges beyond a normal
 * client-bound API key.
 */

const signUpSchema = {
  email: z.string().email().describe("User email address for the new account"),
  password: z.string().min(8).describe("Password (minimum length 8)"),
  data: z.record(z.string(), z.unknown()).optional().describe("Optional additional user metadata / profile data"),
};

const signInSchema = {
  email: z.string().email().describe("Registered user email"),
  password: z.string().describe("User password"),
};

const refreshTokenSchema = {
  refresh_token: z.string().describe("Valid refresh token obtained from a previous sign-in or token refresh"),
};

const adminCreateUserSchema = {
  email: z.string().email().describe("Email for the new admin-created user"),
  password: z.string().optional().describe("Optional initial password (if not provided, usually requires email confirmation flow)"),
  email_confirm: z.boolean().optional().describe("Whether to mark the email as already confirmed"),
  data: z.record(z.string(), z.unknown()).optional().describe("Optional user metadata"),
};

export function registerAuthTools(
  server: McpServer,
  runtime: AthenaRuntime,
): void {
  // ==================== READ OPERATIONS (safe) ====================

  registerTool(server, runtime, {
    description:
      "Retrieve the current authenticated session (user + tokens + metadata) using the Athena Auth SDK. " +
      "Returns session details or an error object if no active session. " +
      "This is the recommended way to inspect who is currently authenticated in agent flows.",
    name: "auth_get_session",
    handler: async ({ clientName, runtime }) => {
      try {
        const auth = runtime.getAuthModule(clientName);
        const res = await (typeof auth?.getSession === "function" ? auth.getSession() : runtime.performAuth(clientName, "get-session"));
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Fetch the current user profile via the Athena Auth SDK (getUser). " +
      "Includes id, email, metadata, email_confirmed_at, etc. when available.",
    name: "auth_get_user",
    handler: async ({ clientName, runtime }) => {
      try {
        const auth = runtime.getAuthModule(clientName);
        const res = await (typeof auth?.getUser === "function" ? auth.getUser() : runtime.performAuth(clientName, "get-user"));
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  // ==================== MUTATING AUTH (blocked in read-only) ====================

  registerTool(server, runtime, {
    description:
      "Sign out / invalidate the current session using the Athena auth SDK. " +
      "Blocked when READ_ONLY=true.",
    name: "auth_sign_out",
    handler: async ({ clientName, runtime }) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_sign_out");
      try {
        const auth = runtime.getAuthModule(clientName);
        const res = await (typeof auth?.signOut === "function" ? auth.signOut() : runtime.performAuth(clientName, "sign-out"));
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Exchange a refresh_token for a fresh access token (and possibly new refresh token). " +
      "Useful for long-running agent sessions.",
    name: "auth_refresh_token",
    shape: refreshTokenSchema,
    handler: async ({ clientName, runtime }, input) => {
      try {
        const auth = runtime.getAuthModule(clientName);
        const res = typeof auth?.refreshToken === "function"
          ? await auth.refreshToken(input.refresh_token)
          : await runtime.performAuth(clientName, "refresh", input);
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Register a new user (email + password + optional metadata) via the Athena Auth SDK. " +
      "Blocked when READ_ONLY=true. " +
      "Depending on server config this may send a confirmation email.",
    name: "auth_sign_up",
    shape: signUpSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_sign_up");
      try {
        const auth = runtime.getAuthModule(clientName);
        const payload = { email: input.email, password: input.password, data: input.data };
        const res = typeof auth?.signUp === "function"
          ? await auth.signUp(payload)
          : await runtime.performAuth(clientName, "sign-up", payload);
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Authenticate with email + password. Returns session (access + refresh tokens, user). " +
      "Blocked when READ_ONLY=true.",
    name: "auth_sign_in",
    shape: signInSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_sign_in");
      try {
        const auth = runtime.getAuthModule(clientName);
        const res = typeof auth?.signIn === "function"
          ? await auth.signIn(input)
          : await runtime.performAuth(clientName, "sign-in", input);
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Trigger the forgot password flow (sends reset email if the user exists). " +
      "Blocked in read-only mode.",
    name: "auth_forgot_password",
    shape: { email: z.string().email().describe("Email of the account that needs a password reset") },
    handler: async ({ clientName, runtime }, { email }) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_forgot_password");
      try {
        const auth = runtime.getAuthModule(clientName);
        const res = typeof auth?.forgetPassword === "function"
          ? await auth.forgetPassword(email)
          : await runtime.performAuth(clientName, "forgot-password", { email });
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "Complete a password reset using the token from the email + the new password. " +
      "Blocked in read-only mode.",
    name: "auth_reset_password",
    shape: {
      token: z.string().describe("One-time reset token from the password reset email"),
      new_password: z.string().min(8).describe("The new password to set"),
    },
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_reset_password");
      try {
        const auth = runtime.getAuthModule(clientName);
        const res = typeof auth?.resetPassword === "function"
          ? await auth.resetPassword(input.new_password, input.token)
          : await runtime.performAuth(clientName, "reset-password", input);
        return jsonContent(res);
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });

  // ==================== ADMIN AUTH (elevated) ====================

  registerTool(server, runtime, {
    description:
      "ADMIN ONLY: List users in the auth system. " +
      "May require a special admin key or elevated rights on the Athena client. " +
      "Not subject to normal client scoping in all deployments.",
    name: "auth_admin_list_users",
    handler: async ({ clientName, runtime }) => {
      try {
        const auth = runtime.getAuthModule(clientName);
        const admin = auth?.admin;
        if (admin && typeof admin.listUsers === "function") {
          return jsonContent(await admin.listUsers());
        }
        return jsonContent(await runtime.sdkRequest(clientName, { service: "auth", path: "/admin/users" }));
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e), hint: "This action often requires ATHENA admin key or specific rights." });
      }
    },
  });

  registerTool(server, runtime, {
    description:
      "ADMIN ONLY: Create a user directly (bypassing normal signup). " +
      "Blocked when READ_ONLY=true. Requires elevated privileges.",
    name: "auth_admin_create_user",
    shape: adminCreateUserSchema,
    handler: async ({ clientName, runtime }, input) => {
      if (runtime.config.readOnly) return readOnlyToolError("auth_admin_create_user");
      try {
        const auth = runtime.getAuthModule(clientName);
        const admin = auth?.admin;
        if (admin && typeof admin.createUser === "function") {
          return jsonContent(await admin.createUser(input));
        }
        return jsonContent(await runtime.sdkRequest(clientName, { service: "auth", path: "/admin/users", method: "POST", body: input }));
      } catch (e: any) {
        return jsonContent({ error: String(e?.message || e) });
      }
    },
  });
}
