import { setInitialUserData } from "../../../lib/setInitialUserData";
import { getAllUserWorkflow } from "../../../server/crudWorkflow";
import { WorkflowList } from "@/components/WorkflowList";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { eq } from "drizzle-orm";

export default function Home() {
  return <WorkflowServer />;
}

async function WorkflowServer() {
  const { userId } = await auth();

  if (!userId) {
    return <div>No auth</div>;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  if (!user) {
    await setInitialUserData(userId);
  }

  const workflow = await getAllUserWorkflow();

  if (!workflow) {
    return <div>No workflow found</div>;
  }

  return <WorkflowList data={workflow} />;
}
