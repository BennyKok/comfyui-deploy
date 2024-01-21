import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseAsInteger } from "next-usequerystate";
import { headers } from "next/headers";
import {
	findAllDeployments,
	findAllRunsWithCounts,
} from "../server/findAllRuns";
import { DeploymentDisplay } from "./DeploymentDisplay";
import { PaginationControl } from "./PaginationControl";
import { RunDisplay } from "./RunDisplay";

const itemPerPage = 6;
const pageParser = parseAsInteger.withDefault(1);

export async function RunsTable(props: {
  workflow_id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // await new Promise((resolve) => setTimeout(resolve, 5000));
  const page = pageParser.parseServerSide(
    props.searchParams?.page ?? undefined
  );
  const { allRuns, total } = await findAllRunsWithCounts({
    workflow_id: props.workflow_id,
    limit: itemPerPage,
    offset: (page - 1) * itemPerPage,
  });
  return (
			<div>
				<div className="overflow-auto h-fit w-full">
					<Table className="">
						{allRuns.length === 0 && (
							<TableCaption>A list of your recent runs.</TableCaption>
						)}
						<TableHeader className="bg-background top-0 sticky">
							<TableRow>
								<TableHead className="truncate">Number</TableHead>
								<TableHead className="truncate">Machine</TableHead>
								<TableHead className="truncate">Time</TableHead>
								<TableHead className="truncate">Version</TableHead>
								<TableHead className="truncate">Origin</TableHead>
								<TableHead className="truncate">Duration</TableHead>
								<TableHead className="truncate">Live Status</TableHead>
								<TableHead className="text-right">Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{allRuns.map((run) => (
								<RunDisplay run={run} key={run.id} />
							))}
						</TableBody>
					</Table>
				</div>

				{Math.ceil(total / itemPerPage) > 0 && (
					<PaginationControl
						totalPage={Math.ceil(total / itemPerPage)}
						currentPage={page}
					/>
				)}
			</div>
		);
}

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
