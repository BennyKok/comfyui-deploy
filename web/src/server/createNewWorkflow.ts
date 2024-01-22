import { db } from "@/db/db";
import type { WorkflowVersionType } from "@/db/schema";
import { workflowTable, workflowVersionTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function createNewWorkflowVersion({
  workflow_id,
  workflowData,
}: {
  workflow_id: string;
  workflowData: Pick<
    WorkflowVersionType,
    "workflow" | "workflow_api" | "snapshot"
  >;
}) {
  // Add a new version
  const data = await db
    .insert(workflowVersionTable)
    .values({
      workflow_id,
      ...workflowData,
      version: sql`(
        SELECT COALESCE(MAX(version), 0) + 1
        FROM ${workflowVersionTable}
        WHERE workflow_id = ${workflow_id}
      )`,
    })
    .returning();
  const version = data[0].version;

  // Touch up the last updated time
  await db
    .update(workflowTable)
    .set({
      updated_at: new Date(),
    })
    .where(eq(workflowTable.id, workflow_id))
    .returning();

  return {
    version,
  };
}

export async function createNewWorkflow({
  workflow_name,
  user_id,
  org_id,
  workflowData,
}: {
  workflow_name: string;
  user_id: string;
  org_id?: string | null;
  workflowData: Pick<
    WorkflowVersionType,
    "workflow" | "workflow_api" | "snapshot"
  >;
}) {
  // Create a new parent workflow
  const workflow_parent = await db
    .insert(workflowTable)
    .values({
      user_id,
      name: workflow_name,
      org_id: org_id,
    })
    .returning();

  const workflow_id = workflow_parent[0].id;

  // Create a new version
  const data = await db
    .insert(workflowVersionTable)
    .values({
      workflow_id: workflow_id,
      version: 1,
      ...workflowData,
    })
    .returning();
  const version = data[0].version;

  return {
    workflow_id,
    version,
  };
}
