"use server";

import { db } from "@/db/db";
import { workflowRunOutputs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getRunsOutput(run_id: string) {
  return await db
    .select()
    .from(workflowRunOutputs)
    .where(eq(workflowRunOutputs.run_id, run_id));
}
