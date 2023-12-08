import { relations, type InferSelectModel } from "drizzle-orm";
import {
  text,
  pgSchema,
  uuid,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const dbSchema = pgSchema("comfy_deploy");

export const usersTable = dbSchema.table("users", {
  id: text("id").primaryKey().notNull(),
  username: text("username").notNull(),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  // primary_avatar_id: uuid("primary_avatar_id").references(
  //   () => chatAvatarTable.id,
  // ),
  // twitter_initial_json: jsonb("twitter_initial_json").$type<
  //   Omit<UserV2Result, "errors">
  // >(),
  // initial_prompt: text("initial_prompt"),
  // payment_status: text("payment_status"),
  // early_access: boolean("early_access").default(false),
});

// export const usersRelations = relations(userTable, ({ many }) => ({
//   chat_avatars: many(chatAvatarTable),
// }));

export const workflowTable = dbSchema.table("workflows", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  user_id: text("user_id")
    .references(() => usersTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRelations = relations(workflowTable, ({ many }) => ({
  versions: many(workflowVersionTable),
}));

export const workflowVersionTable = dbSchema.table("workflow_versions", {
  workflow_id: uuid("workflow_id")
    .notNull()
    .references(() => workflowTable.id, {
      onDelete: "cascade",
    }),
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  workflow: jsonb("workflow").$type<any>(),
  workflow_api: jsonb("workflow_api").$type<any>(),
  version: integer("version").notNull(),

  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

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
  "success",
  "failed",
]);

// We still want to keep the workflow run record.
export const workflowRunsTable = dbSchema.table("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  workflow_version_id: uuid("workflow_version_id")
    .notNull()
    .references(() => workflowVersionTable.id, {
      onDelete: "no action",
    }),
  machine_id: uuid("machine_id")
    .notNull()
    .references(() => machinesTable.id, {
      onDelete: "no action",
    }),
  status: workflowRunStatus("status").notNull().default("not-started"),
  ended_at: timestamp("ended_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// when user delete, also delete all the workflow versions
export const machinesTable = dbSchema.table("machines", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  user_id: text("user_id").references(() => usersTable.id, {
    onDelete: "no action",
  }).notNull(),
  name: text("name").notNull(),
  endpoint: text("endpoint").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// export const chatAvatarRelations = relations(chatAvatarTable, ({ one }) => ({
//   author: one(userTable, {
//     fields: [chatAvatarTable.user_id],
//     references: [userTable.id],
//   }),
// }));

// export const subscriptionTable = dbSchema.table("subscription", {
//   id: text("id").primaryKey().notNull(),
//   email: text("email"),
//   user_id: text("user_id"),
//   status: text("status"),
//   created_at: timestamp("created_at").defaultNow(),
//   updated_at: timestamp("updated_at").defaultNow(),
// });

// export const subscriptionRelations = relations(
//   subscriptionTable,
//   ({ one }) => ({
//     user: one(userTable, {
//       fields: [subscriptionTable.user_id],
//       references: [userTable.id],
//     }),
//   }),
// );

export type UserType = InferSelectModel<typeof usersTable>;
export type WorkflowType = InferSelectModel<typeof workflowTable>;
// export type ChatAvatarType = InferSelectModel<typeof chatAvatarTable>;
// export type SubscriptionType = InferSelectModel<typeof subscriptionTable>;
