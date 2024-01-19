import { db } from "@/db/db";
import {
  deploymentsTable,
  workflowTable,
  workflowVersionTable,
} from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { and, desc, eq, isNull } from "drizzle-orm";

export async function getAllUserWorkflow() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  const workflow = await db.query.workflowTable.findMany({
    with: {
      user: {
        columns: {
          name: true,
        },
      },
      versions: {
        limit: 1,
        orderBy: desc(workflowVersionTable.version),
        columns: {
          id: true,
          version: true,
        },
      },
      deployments: {
        limit: 1,
        where: eq(deploymentsTable.environment, "public-share"),
        columns: {
          id: true,
        },
      },
    },
    columns: {
      id: true,
      updated_at: true,
      name: true,
    },
    orderBy: desc(workflowTable.updated_at),
    where:
      orgId != undefined
        ? eq(workflowTable.org_id, orgId)
        : and(eq(workflowTable.user_id, userId), isNull(workflowTable.org_id)),
  });

  return workflow;
}
