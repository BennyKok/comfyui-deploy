import { MachineBuildLog } from "../../../../components/MachineBuildLog";
import { LogsViewer } from "@/components/LogsViewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRelativeTime } from "@/lib/getRelativeTime";
import { getMachineById } from "@/server/curdMachine";

export default async function Page({
  params,
}: {
  params: { machine_id: string };
}) {
  const machine = await getMachineById(params.machine_id);

  return (
    <div>
      <Card className="w-full h-fit mt-4">
        <CardHeader>
          <CardTitle>{machine.name}</CardTitle>
          <CardDescription suppressHydrationWarning={true}>
            {getRelativeTime(machine?.updated_at)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {machine.status == "building" && (
            <MachineBuildLog
              instance_id={machine.build_machine_instance_id!}
              machine_id={params.machine_id}
              endpoint={process.env.MODAL_BUILDER_URL!}
            />
          )}
          {machine.status !== "building" && machine.build_log && (
            <LogsViewer logs={JSON.parse(machine.build_log)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
