"use server";

import { db } from "@/db/db";
import { workflowRunOutputs, workflowRunsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getRunsOutput(run_id: string) {
  // throw new Error("Not implemented");
  return await db
    .select()
    .from(workflowRunOutputs)
    .where(eq(workflowRunOutputs.run_id, run_id));
}

export async function getRunsData(run_id: string) {
  // throw new Error("Not implemented");
  return await db.query.workflowRunsTable.findFirst({
    where: eq(workflowRunsTable.id, run_id),
    with: {
      outputs: {
        columns: {
          data: true,
        },
      },
    },
  });
}
