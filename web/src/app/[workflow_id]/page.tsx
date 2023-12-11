import { RunDisplay } from "../../components/RunDisplay";
import { LoadingIcon } from "@/components/LoadingIcon";
import { MachinesWSMain } from "@/components/MachinesWS";
import {
  MachineSelect,
  RunWorkflowButton,
  VersionSelect,
} from "@/components/VersionSelect";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db/db";
import {
  workflowRunsTable,
  workflowTable,
  workflowVersionTable,
} from "@/db/schema";
import { getRelativeTime } from "@/lib/getRelativeTime";
import { getMachines } from "@/server/curdMachine";
import { desc, eq } from "drizzle-orm";

export async function findFirstTableWithVersion(workflow_id: string) {
  return await db.query.workflowTable.findFirst({
    with: { versions: { orderBy: desc(workflowVersionTable.version) } },
    where: eq(workflowTable.id, workflow_id),
  });
}

export async function findAllRuns(workflow_id: string) {
  return await db.query.workflowRunsTable.findMany({
    where: eq(workflowRunsTable.workflow_id, workflow_id),
    orderBy: desc(workflowRunsTable.created_at),
    with: {
      machine: {
        columns: {
          name: true,
        },
      },
      version: {
        columns: {
          version: true,
        },
      },
    },
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
      <Card className="w-full lg:w-fit lg:min-w-[500px] h-fit">
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
            <RunWorkflowButton workflow={workflow} machines={machines} />
          </div>

          <MachinesWSMain machines={machines} />
        </CardContent>
      </Card>

      <Card className="w-full ">
        <CardHeader>
          <CardTitle>Run</CardTitle>
        </CardHeader>

        <CardContent>
          <RunsTable workflow_id={workflow_id} />
        </CardContent>
      </Card>
    </div>
  );
}

async function RunsTable(props: { workflow_id: string }) {
  const allRuns = await findAllRuns(props.workflow_id);
  return (
    <Table>
      <TableCaption>A list of your recent runs.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Version</TableHead>
          <TableHead>Machine</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Live Status</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {allRuns.map((run) => (
          <RunDisplay run={run} key={run.id} />
        ))}
      </TableBody>
    </Table>
  );
}

export function StatusBadge({
  run,
}: {
  run: Awaited<ReturnType<typeof findAllRuns>>[0];
}) {
  switch (run.status) {
    case "running":
      return (
        <Badge variant="secondary">
          {run.status} <LoadingIcon />
        </Badge>
      );
    case "success":
      return <Badge variant="success">{run.status}</Badge>;
    case "failed":
      return <Badge variant="destructive">{run.status}</Badge>;
  }
  return <Badge variant="secondary">{run.status}</Badge>;
}
