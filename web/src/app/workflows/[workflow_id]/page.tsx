import { DeploymentsTable, RunsTable } from "../../../components/RunsTable";
import { findFirstTableWithVersion } from "../../../server/findFirstTableWithVersion";
import { MachinesWSMain } from "@/components/MachinesWS";
import { VersionDetails } from "@/components/VersionDetails";
import {
  CopyWorkflowVersion,
  CreateDeploymentButton,
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
import { getRelativeTime } from "@/lib/getRelativeTime";
import { getMachines } from "@/server/curdMachine";

export default async function Page({
  params,
}: {
  params: { workflow_id: string };
}) {
  const workflow_id = params.workflow_id;

  const workflow = await findFirstTableWithVersion(workflow_id);
  const machines = await getMachines();

  return (
    <div className="mt-4 w-full flex flex-col lg:flex-row gap-4 max-h-[calc(100dvh-100px)]">
      <div className="flex gap-4 flex-col">
        <Card className="w-full lg:w-fit lg:min-w-[600px] h-fit">
          <CardHeader>
            <CardTitle>{workflow?.name}</CardTitle>
            <CardDescription suppressHydrationWarning={true}>
              {getRelativeTime(workflow?.updated_at)}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <VersionSelect workflow={workflow} />
              <MachineSelect machines={machines} />
              <RunWorkflowButton workflow={workflow} machines={machines} />
              <CreateDeploymentButton workflow={workflow} machines={machines} />
              <CopyWorkflowVersion workflow={workflow} />
            </div>

            <VersionDetails workflow={workflow} />
            <MachinesWSMain machines={machines} />
          </CardContent>
        </Card>
        <Card className="w-full h-fit">
          <CardHeader>
            <CardTitle>Deployments</CardTitle>
          </CardHeader>

          <CardContent>
            <DeploymentsTable workflow_id={workflow_id} />
          </CardContent>
        </Card>
      </div>

      <Card className="w-full h-fit">
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
