import { findAllRuns } from "../server/findAllRuns";
import { RunDisplay } from "./RunDisplay";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function RunsTable(props: { workflow_id: string }) {
  const allRuns = await findAllRuns(props.workflow_id);
  return (
    <div className="overflow-auto h-[400px] w-full">
      <Table className="">
        <TableCaption>A list of your recent runs.</TableCaption>
        <TableHeader className="bg-background top-0 sticky">
          <TableRow>
            <TableHead className=" w-[100px]">Version</TableHead>
            <TableHead className="">Machine</TableHead>
            <TableHead className="">Time</TableHead>
            <TableHead className="">Live Status</TableHead>
            <TableHead className=" text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allRuns.map((run) => (
            <RunDisplay run={run} key={run.id} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
