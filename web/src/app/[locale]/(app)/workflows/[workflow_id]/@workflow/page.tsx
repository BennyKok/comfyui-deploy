import { CreateShareButton } from "@/components/CreateShareButton";
import { MachinesWSMain } from "@/components/MachinesWS";
import { VersionDetails } from "@/components/VersionDetails";
import {
  CopyWorkflowVersion,
  CreateDeploymentButton,
  MachineSelect,
  OpenEditButton,
  RunWorkflowButton,
  VersionSelect,
  ViewWorkflowDetailsButton,
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
import { findFirstTableWithVersion } from "@/server/findFirstTableWithVersion";

export default async function Page({
  params,
}: {
  params: { workflow_id: string };
}) {
  const workflow_id = params.workflow_id;

  const workflow = await findFirstTableWithVersion(workflow_id);
  const machines = await getMachines();

  return (
    <Card className="w-full h-fit">
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
          <CreateShareButton workflow={workflow} machines={machines} />
          <CopyWorkflowVersion workflow={workflow} />
          <ViewWorkflowDetailsButton workflow={workflow} />
          <OpenEditButton workflow={workflow} machines={machines} />
        </div>

        <VersionDetails workflow={workflow} />
        <MachinesWSMain machines={machines} />
      </CardContent>
    </Card>
  );
}
