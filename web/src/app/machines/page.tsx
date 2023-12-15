import { MachineList } from "@/components/MachineList";
import { db } from "@/db/db";
import { machinesTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { desc, eq } from "drizzle-orm";

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
