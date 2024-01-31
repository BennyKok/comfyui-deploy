import { db } from "@/db/db";
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { subscriptionStatusTable } from "@/db/schema";
import { APIKeyUserType } from "@/server/APIKeyBodyRequest";
import { auth } from "@clerk/nextjs";
import "server-only";

export async function getCurrentPlanWithAuth() {
  const { userId, orgId } = auth();

  const sub = await getCurrentPlan({
    org_id: orgId,
    user_id: userId,
  });

  return sub;
}

export async function getCurrentPlan({ user_id, org_id }: APIKeyUserType) {
  if (!user_id) throw new Error("No user id");

  const sub = await db.query.subscriptionStatusTable.findFirst({
    where: and(
      eq(subscriptionStatusTable.user_id, user_id),
      org_id
        ? eq(subscriptionStatusTable.org_id, org_id)
        : or(
            isNull(subscriptionStatusTable.org_id),
            eq(subscriptionStatusTable.org_id, ""),
          ),
      ne(subscriptionStatusTable.status, "deleted"),
    ),
    orderBy: desc(subscriptionStatusTable.created_at),
  });

  return sub;
}
