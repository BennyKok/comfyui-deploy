"use server";

import { RunOutputs } from "@/components/RunOutputs";
import { db } from "@/db/db";
import { workflowRunOutputs } from "@/db/schema";
import { eq } from "drizzle-orm";

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
