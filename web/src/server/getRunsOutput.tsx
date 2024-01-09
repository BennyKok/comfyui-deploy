"use server";

import { RunOutputs } from "@/components/RunOutputs";
import { db } from "@/db/db";
import { workflowRunOutputs, workflowRunsTable } from "@/db/schema";
import type { APIKeyUserType } from "@/server/APIKeyBodyRequest";
import { and, eq } from "drizzle-orm";

export async function getRunsOutputDisplay(run_id: string) {
  return <RunOutputs run_id={run_id} />;
}

export async function getRunsOutput(run_id: string) {
  // throw new Error("Not implemented");
  return await db
    .select()
    .from(workflowRunOutputs)
    .where(eq(workflowRunOutputs.run_id, run_id));
}

export async function getRunsData(user: APIKeyUserType, run_id: string) {
  const data = await db.query.workflowRunsTable.findFirst({
    where: and(eq(workflowRunsTable.id, run_id)),
    with: {
      workflow: {
        columns: {
          org_id: true,
          user_id: true,
        },
      },
      outputs: {
        columns: {
          data: true,
        },
      },
    },
  });

  if (!data) {
    return null;
  }

  if (user.org_id) {
    // is org api call, check org only
    if (data.workflow.org_id != user.org_id) {
      return null;
    }
  } else {
    // is user api call, check user only
    if (data.workflow.user_id != user.user_id && data.workflow.org_id == null) {
      return null;
    }
  }

  return data;
}
