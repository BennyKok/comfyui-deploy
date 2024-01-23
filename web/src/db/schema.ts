import { type InferSelectModel, relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const dbSchema = pgSchema("comfyui_deploy");

export const usersTable = dbSchema.table("users", {
  id: text("id").primaryKey().notNull(),
  username: text("username").notNull(),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const workflowTable = dbSchema.table("workflows", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  user_id: text("user_id")
    .references(() => usersTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  org_id: text("org_id"),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowSchema = createSelectSchema(workflowTable);

export const workflowRelations = relations(workflowTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [workflowTable.user_id],
    references: [usersTable.id],
  }),
  versions: many(workflowVersionTable),
  deployments: many(deploymentsTable),
}));

export const workflowType = z.any();
// export const workflowType = z.object({
//   last_node_id: z.number(),
//   last_link_id: z.number(),
//   nodes: z.array(
//     z.object({
//       id: z.number(),
//       type: z.string(),
//       widgets_values: z.array(z.any()),
//     })
//   ),
// });

export const workflowAPINodeType = z.object({
  inputs: z.record(z.any()),
  class_type: z.string().optional(),
});

export const workflowAPIType = z.record(workflowAPINodeType);

export const workflowVersionTable = dbSchema.table("workflow_versions", {
  workflow_id: uuid("workflow_id")
    .notNull()
    .references(() => workflowTable.id, {
      onDelete: "cascade",
    }),
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  workflow: jsonb("workflow").$type<z.infer<typeof workflowType>>(),
  workflow_api: jsonb("workflow_api").$type<z.infer<typeof workflowAPIType>>(),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").$type<z.infer<typeof snapshotType>>(),

  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
export const workflowVersionSchema = createSelectSchema(workflowVersionTable);

export const workflowVersionRelations = relations(
  workflowVersionTable,
  ({ one }) => ({
    workflow: one(workflowTable, {
      fields: [workflowVersionTable.workflow_id],
      references: [workflowTable.id],
    }),
  }),
);

export const workflowRunStatus = pgEnum("workflow_run_status", [
  "not-started",
  "running",
  "uploading",
  "success",
  "failed",
]);

export const deploymentEnvironment = pgEnum("deployment_environment", [
  "staging",
  "production",
  "public-share",
]);

export const workflowRunOrigin = pgEnum("workflow_run_origin", [
  "manual",
  "api",
  "public-share",
]);

export const WorkflowRunOriginSchema = z.enum(workflowRunOrigin.enumValues);
export type WorkflowRunOriginType = z.infer<typeof WorkflowRunOriginSchema>;

export const machineGPUOptions = pgEnum("machine_gpu", ["T4", "A10G", "A100"]);

export const machinesType = pgEnum("machine_type", [
  "classic",
  "runpod-serverless",
  "modal-serverless",
  "comfy-deploy-serverless",
]);

export const machinesStatus = pgEnum("machine_status", [
  "ready",
  "building",
  "error",
]);

// We still want to keep the workflow run record.
export const workflowRunsTable = dbSchema.table("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  // when workflow version deleted, still want to keep this record
  workflow_version_id: uuid("workflow_version_id").references(
    () => workflowVersionTable.id,
    {
      onDelete: "set null",
    },
  ),
  workflow_inputs:
    jsonb("workflow_inputs").$type<Record<string, string | number>>(),
  workflow_id: uuid("workflow_id")
    .notNull()
    .references(() => workflowTable.id, {
      onDelete: "cascade",
    }),
  // when machine deleted, still want to keep this record
  machine_id: uuid("machine_id").references(() => machinesTable.id, {
    onDelete: "set null",
  }),
  origin: workflowRunOrigin("origin").notNull().default("api"),
  status: workflowRunStatus("status").notNull().default("not-started"),
  ended_at: timestamp("ended_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  started_at: timestamp("started_at"),
});

export const workflowRunRelations = relations(
  workflowRunsTable,
  ({ one, many }) => ({
    machine: one(machinesTable, {
      fields: [workflowRunsTable.machine_id],
      references: [machinesTable.id],
    }),
    version: one(workflowVersionTable, {
      fields: [workflowRunsTable.workflow_version_id],
      references: [workflowVersionTable.id],
    }),
    outputs: many(workflowRunOutputs),
    workflow: one(workflowTable, {
      fields: [workflowRunsTable.workflow_id],
      references: [workflowTable.id],
    }),
  }),
);

// We still want to keep the workflow run record.
export const workflowRunOutputs = dbSchema.table("workflow_run_outputs", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  run_id: uuid("run_id")
    .notNull()
    .references(() => workflowRunsTable.id, {
      onDelete: "cascade",
    }),
  data: jsonb("data").$type<any>(),

  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowOutputRelations = relations(
  workflowRunOutputs,
  ({ one }) => ({
    run: one(workflowRunsTable, {
      fields: [workflowRunOutputs.run_id],
      references: [workflowRunsTable.id],
    }),
  }),
);

// when user delete, also delete all the workflow versions
export const machinesTable = dbSchema.table("machines", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  user_id: text("user_id")
    .references(() => usersTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  name: text("name").notNull(),
  org_id: text("org_id"),
  endpoint: text("endpoint").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  disabled: boolean("disabled").default(false).notNull(),
  auth_token: text("auth_token"),
  type: machinesType("type").notNull().default("classic"),
  status: machinesStatus("status").notNull().default("ready"),
  snapshot: jsonb("snapshot").$type<any>(),
  models: jsonb("models").$type<any>(),
  gpu: machineGPUOptions("gpu"),
  build_machine_instance_id: text("build_machine_instance_id"),
  build_log: text("build_log"),
});

export const snapshotType = z.object({
  comfyui: z.string(),
  git_custom_nodes: z.record(
    z.object({
      hash: z.string(),
      disabled: z.boolean(),
    }),
  ),
  file_custom_nodes: z.array(z.any()),
});

export const insertMachineSchema = createInsertSchema(machinesTable, {
  name: (schema) => schema.name.default("My Machine"),
  endpoint: (schema) => schema.endpoint.default("http://127.0.0.1:8188"),
  type: (schema) => schema.type.default("classic"),
});

export const showcaseMedia = z.array(
  z.object({
    url: z.string(),
    isCover: z.boolean().default(false),
  }),
);

export const showcaseMediaNullable = z
  .array(
    z.object({
      url: z.string(),
      isCover: z.boolean().default(false),
    }),
  )
  .nullable();

export const deploymentsTable = dbSchema.table("deployments", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  user_id: text("user_id")
    .references(() => usersTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  org_id: text("org_id"),
  workflow_version_id: uuid("workflow_version_id")
    .notNull()
    .references(() => workflowVersionTable.id),
  workflow_id: uuid("workflow_id")
    .notNull()
    .references(() => workflowTable.id, {
      onDelete: "cascade",
    }),
  machine_id: uuid("machine_id")
    .notNull()
    .references(() => machinesTable.id),
  share_slug: text("share_slug").unique(),
  description: text("description"),
  showcase_media:
    jsonb("showcase_media").$type<z.infer<typeof showcaseMedia>>(),
  environment: deploymentEnvironment("environment").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const publicShareDeployment = z.object({
  description: z.string().nullable(),
  showcase_media: showcaseMedia,
});

// createInsertSchema(deploymentsTable, {
//   description: (schema) => schema.description.default(""),
//   showcase_media: () => showcaseMedia.default([]),
// }).pick({
//   description: true,
//   showcase_media: true,
// });

export const deploymentsRelations = relations(deploymentsTable, ({ one }) => ({
  machine: one(machinesTable, {
    fields: [deploymentsTable.machine_id],
    references: [machinesTable.id],
  }),
  version: one(workflowVersionTable, {
    fields: [deploymentsTable.workflow_version_id],
    references: [workflowVersionTable.id],
  }),
  workflow: one(workflowTable, {
    fields: [deploymentsTable.workflow_id],
    references: [workflowTable.id],
  }),
  user: one(usersTable, {
    fields: [deploymentsTable.user_id],
    references: [usersTable.id],
  }),
}));

export const apiKeyTable = dbSchema.table("api_keys", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  user_id: text("user_id")
    .references(() => usersTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  org_id: text("org_id"),
  revoked: boolean("revoked").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const authRequestsTable = dbSchema.table("auth_requests", {
  request_id: text("request_id").primaryKey().notNull(),
  user_id: text("user_id"),
  org_id: text("org_id"),
  api_hash: text("api_hash"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  expired_date: timestamp("expired_date"),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type UserType = InferSelectModel<typeof usersTable>;
export type WorkflowType = InferSelectModel<typeof workflowTable>;
export type MachineType = InferSelectModel<typeof machinesTable>;
export type WorkflowVersionType = InferSelectModel<typeof workflowVersionTable>;
export type DeploymentType = InferSelectModel<typeof deploymentsTable>;
