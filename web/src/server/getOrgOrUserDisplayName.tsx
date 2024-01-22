import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { clerkClient } from "@clerk/nextjs";
import { eq } from "drizzle-orm";

export async function getOrgOrUserDisplayName(
  orgId: string | undefined | null,
  userId: string,
) {
  return orgId
    ? await clerkClient.organizations
        .getOrganization({
          organizationId: orgId,
        })
        .then((x) => x.name)
    : (await db.select().from(usersTable).where(eq(usersTable.id, userId)))[0]
        .name;
}
