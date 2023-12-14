import { db } from "@/db/db";
import { deploymentsTable, workflowRunsTable } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function findAllRuns(workflow_id: string) {
  return await db.query.workflowRunsTable.findMany({
    where: eq(workflowRunsTable.workflow_id, workflow_id),
    orderBy: desc(workflowRunsTable.created_at),
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
      version: {
        columns: {
          version: true,
        },
      },
    },
  });
}
