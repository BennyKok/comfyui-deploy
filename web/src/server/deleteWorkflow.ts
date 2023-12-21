"use server";

import { db } from "@/db/db";
import { workflowTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import "server-only";

export async function deleteWorkflow(workflow_id: string) {
  await db.delete(workflowTable).where(eq(workflowTable.id, workflow_id));
  revalidatePath("/");
}
