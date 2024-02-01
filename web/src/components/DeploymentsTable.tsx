import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { headers } from "next/headers";
import { findAllDeployments } from "../server/findAllRuns";
import { DeploymentDisplay } from "./DeploymentDisplay";

export async function DeploymentsTable(props: { workflow_id: string }) {
  const allRuns = await findAllDeployments(props.workflow_id);

  const headersList = headers();
  const host = headersList.get("host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "";
  const domain = `${protocol}://${host}`;

  return (
    <div className="overflow-auto h-fit w-full">
      <Table className="">
        <TableCaption>A list of your deployments</TableCaption>
        <TableHeader className="bg-background top-0 sticky">
          <TableRow>
            <TableHead className=" w-[100px]">Environment</TableHead>
            <TableHead className=" w-[100px]">Version</TableHead>
            <TableHead className="">Machine</TableHead>
            <TableHead className=" text-right">Updated At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allRuns.map((run) => (
            <DeploymentDisplay deployment={run} key={run.id} domain={domain} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
