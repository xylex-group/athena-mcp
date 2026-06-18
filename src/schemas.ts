import { z } from "zod";

export const jsonScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const stringRecordSchema = z.record(z.string(), z.unknown());

export const managementColumnSchema = z.object({
  name: z.string().describe("Column name"),
  data_type: z.string().describe("PostgreSQL data type"),
  nullable: z.boolean().optional().describe("Whether the column is nullable"),
  default_expression: z
    .string()
    .optional()
    .describe("Optional SQL default expression"),
});

export const editTableOperationSchema = z.union([
  z.object({
    type: z.literal("add_column"),
    column: managementColumnSchema,
  }),
  z.object({
    type: z.literal("rename_column"),
    from: z.string(),
    to: z.string(),
  }),
  z.object({
    type: z.literal("set_default"),
    column_name: z.string(),
    default_expression: z.string(),
  }),
  z.object({
    type: z.literal("drop_default"),
    column_name: z.string(),
  }),
  z.object({
    type: z.literal("set_not_null"),
    column_name: z.string(),
  }),
  z.object({
    type: z.literal("drop_not_null"),
    column_name: z.string(),
  }),
]);

export const pipelineConditionSchema = z.object({
  eq_column: z.string(),
  eq_value: z.string(),
});

export const pipelineSourceSchema = z.object({
  table_name: z.string().optional(),
  view_name: z.string().optional(),
  columns: z.array(z.string()).optional(),
  conditions: z.array(pipelineConditionSchema).optional(),
  limit: z.number().int().positive().optional(),
});

export const pipelineTransformSchema = z.object({
  group_by: z.string().optional(),
  time_granularity: z.enum(["day", "hour", "minute"]).optional(),
  aggregation_column: z.string().optional(),
  aggregation_strategy: z.enum(["cumulative_sum"]).optional(),
  aggregation_dedup: z.boolean().optional(),
});

export const pipelineSinkSchema = z.object({
  table_name: z.string().optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().describe("Human-readable API key name"),
  description: z.string().optional().describe("Optional description"),
  client_name: z
    .string()
    .optional()
    .describe("Optional client binding for this key"),
  expires_at: z
    .string()
    .optional()
    .describe("Optional ISO date-time expiry"),
  rights: z.array(z.string()).optional().describe("Rights to grant"),
});

export const updateApiKeySchema = z.object({
  id: z.string().describe("API key UUID"),
  name: z.string().optional(),
  description: z.string().optional(),
  client_name: z.string().optional(),
  expires_at: z.string().optional(),
  is_active: z.boolean().optional(),
  rights: z.array(z.string()).optional(),
});

export const apiKeyRightSchema = z.object({
  name: z.string().describe("Right name"),
  description: z.string().optional().describe("Optional description"),
});

export const saveAthenaClientSchema = z.object({
  client_name: z.string().describe("Athena client name"),
  description: z.string().optional(),
  pg_uri: z.string().optional(),
  pg_uri_env_var: z.string().optional(),
  is_active: z.boolean().optional(),
});
