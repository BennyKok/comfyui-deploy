import { db } from "@/db/db";
import { workflowTable, workflowVersionTable } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function findFirstTableWithVersion(workflow_id: string) {
  return await db.query.workflowTable.findFirst({
    with: { versions: { orderBy: desc(workflowVersionTable.version) } },
    where: eq(workflowTable.id, workflow_id),
  });
}
