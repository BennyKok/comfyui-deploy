import { WorkflowList } from "@/components/WorkflowList";
import { db } from "@/db/db";
import { usersTable, workflowTable, workflowVersionTable } from "@/db/schema";
import { auth, clerkClient } from "@clerk/nextjs";
import { and, desc, eq, isNull } from "drizzle-orm";

export default function Home() {
  return <WorkflowServer />;
}

async function WorkflowServer() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return <div>No auth</div>;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  if (!user) {
    await setInitialUserData(userId);
  }

  const workflow = await db.query.workflowTable.findMany({
    // extras: {
    //   count: sql<number>`(select count(*) from ${workflowVersionTable})`.as(
    //     "count",
    //   ),
    // },
    with: {
      versions: {
        limit: 1,
        orderBy: desc(workflowVersionTable.version),
      },
    },
    orderBy: desc(workflowTable.updated_at),
    where:
      orgId != undefined
        ? eq(workflowTable.org_id, orgId)
        : and(eq(workflowTable.user_id, userId), isNull(workflowTable.org_id)),
  });

  return (
    <WorkflowList
      data={workflow.map((x) => {
        return {
          id: x.id,
          email: x.name,
          amount: x.versions[0]?.version ?? 0,
          date: x.updated_at,
        };
      })}
    />
  );
}

async function setInitialUserData(userId: string) {
  const user = await clerkClient.users.getUser(userId);

  // incase we dont have username such as google login, fallback to first name + last name
  const usernameFallback =
    user.username ?? (user.firstName ?? "") + (user.lastName ?? "");

  // For the display name, if it for some reason is empty, fallback to username
  let nameFallback = (user.firstName ?? "") + (user.lastName ?? "");
  if (nameFallback === "") {
    nameFallback = usernameFallback;
  }

  const result = await db.insert(usersTable).values({
    id: userId,
    // this is used for path, make sure this is unique
    username: usernameFallback,

    // this is for display name, maybe different from username
    name: nameFallback,
  });
}
