import { db } from "@/db/db";
import { deploymentsTable, workflowRunsTable } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function findAllRuns(workflow_id: string) {
  return await db.query.workflowRunsTable.findMany({
    where: eq(workflowRunsTable.workflow_id, workflow_id),
    orderBy: desc(workflowRunsTable.created_at),
    limit: 10,
    extras: {
      number: sql<number>`row_number() over (order by created_at)`.as("number"),
    },
    with: {
      machine: {
        columns: {
          name: true,
          endpoint: true,
        },
      },
      version: {
        columns: {
          version: true,
        },
      },
    },
  });
}

export async function findAllDeployments(workflow_id: string) {
  return await db.query.deploymentsTable.findMany({
    where: eq(deploymentsTable.workflow_id, workflow_id),
    orderBy: desc(deploymentsTable.environment),
    with: {
      machine: {
        columns: {
          name: true,
        },
      },
      version: true,
    },
  });
}
