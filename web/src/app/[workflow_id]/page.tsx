import {
  MachineSelect,
  RunWorkflowButton,
  VersionSelect,
} from "@/components/VersionSelect";
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
  TableCell,
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
  const workflowVersion = await db.query.workflowVersionTable.findFirst({
    where: eq(workflowVersionTable.workflow_id, workflow_id),
  });

  if (!workflowVersion) {
    return [];
  }

  return await db.query.workflowRunsTable.findMany({
    where: eq(workflowRunsTable.workflow_version_id, workflowVersion?.id),
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
            <RunWorkflowButton workflow={workflow} machines={machines} />
          </div>
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
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {allRuns.map((run) => (
          <TableRow key={run.id}>
            <TableCell>{run.version.version}</TableCell>
            <TableCell className="font-medium">{run.machine.name}</TableCell>
            <TableCell>{getRelativeTime(run.created_at)}</TableCell>
            <TableCell className="text-right">{run.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
