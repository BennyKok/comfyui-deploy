import { MachineSelect, VersionSelect } from "@/components/VersionSelect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/db";
import { workflowTable, workflowVersionTable } from "@/db/schema";
import { getRelativeTime } from "@/lib/getRelativeTime";
import { getMachines } from "@/server/curdMachine";
import { desc, eq, sql } from "drizzle-orm";
import { Play } from "lucide-react";

export async function findFirstTableWithVersion(workflow_id: string) {
  return await db.query.workflowTable.findFirst({
    with: { versions: { orderBy: desc(workflowVersionTable.version) } },
    where: eq(workflowTable.id, workflow_id),
  });
}

export default async function Page({
  params,
}: {
  params: { workflow_id: string };
}) {
  const workflow_id = params.workflow_id;

  const workflow = await findFirstTableWithVersion(workflow_id);
  const machines = await getMachines();

  return (
    <div className="mt-4 w-full flex flex-col lg:flex-row gap-4">
      <Card className="w-full lg:w-fit lg:min-w-[500px]">
        <CardHeader>
          <CardTitle>{workflow?.name}</CardTitle>
          <CardDescription suppressHydrationWarning={true}>
            {getRelativeTime(workflow?.updated_at)}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex gap-2 ">
            <VersionSelect workflow={workflow} />
            <MachineSelect machines={machines} />
            <Button className="gap-2">
              Run <Play size={14} />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full ">
        <CardHeader>
          <CardTitle>Run</CardTitle>
        </CardHeader>

        <CardContent></CardContent>
      </Card>
    </div>
  );
}
