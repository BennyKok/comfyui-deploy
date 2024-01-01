import { MachineList } from "@/components/MachineList";
import { db } from "@/db/db";
import { machinesTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { desc, eq, isNull, and } from "drizzle-orm";

export default function Page() {
  return <MachineListServer />;
}

async function MachineListServer() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return <div>No auth</div>;
  }

  const machines = await db.query.machinesTable.findMany({
    orderBy: desc(machinesTable.updated_at),
    where:
      orgId != undefined
        ? eq(machinesTable.org_id, orgId)
        : and(eq(machinesTable.user_id, userId), isNull(machinesTable.org_id)),
  });

  return (
    <div className="w-full">
      {/* <div>Machines</div> */}
      <MachineList data={machines} />
    </div>
  );
}
