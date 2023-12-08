import { MachineList } from "@/components/MachineList";
import { WorkflowList } from "@/components/WorkflowList";
import { db } from "@/db/db";
import {
  machinesTable,
  usersTable,
  workflowTable,
  workflowVersionTable,
} from "@/db/schema";
import { auth, clerkClient } from "@clerk/nextjs";
import { desc, eq, sql } from "drizzle-orm";

export default function Page() {
  return <MachineListServer />;
}

async function MachineListServer() {
  const { userId } = await auth();

  if (!userId) {
    return <div>No auth</div>;
  }

  const workflow = await db.query.machinesTable.findMany({
    orderBy: desc(machinesTable.updated_at),
    where: eq(machinesTable.user_id, userId),
  });

  return (
    <div className="w-full">
      {/* <div>Machines</div> */}
      <MachineList
        data={workflow.map((x) => {
          return {
            id: x.id,
            name: x.name,
            date: x.updated_at,
            endpoint: x.endpoint,
          };
        })}
      />
    </div>
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
