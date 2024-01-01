import { db } from "@/db/db";
import { workflowTable, workflowVersionTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { and, desc, eq, isNull } from "drizzle-orm";

export async function findFirstTableWithVersion(workflow_id: string) {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No auth");
  return await db.query.workflowTable.findFirst({
    with: { versions: { orderBy: desc(workflowVersionTable.version) } },
    where: and(
      eq(workflowTable.id, workflow_id),
      orgId
        ? eq(workflowTable.org_id, orgId)
        : and(eq(workflowTable.user_id, userId), isNull(workflowTable.org_id))
    ),
  });
}

export function findWorkflowById(workflow_id: string) {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No auth");

  return db.query.workflowTable.findFirst({
    columns: {
      id: true,
    },
    where: and(
      eq(workflowTable.id, workflow_id),
      orgId
        ? eq(workflowTable.org_id, orgId)
        : and(eq(workflowTable.user_id, userId), isNull(workflowTable.org_id))
    ),
  });
}
