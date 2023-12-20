import { OutputRender } from "./OutputRender";
import { CodeBlock } from "@/components/CodeBlock";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { findAllRuns } from "@/server/findAllRuns";
import { getRunsOutput } from "@/server/getRunsOutput";

export async function RunInputs({
  run,
}: {
  run: Awaited<ReturnType<typeof findAllRuns>>[0];
}) {
  return (
    <>
      {run.workflow_inputs && (
        <Table className="table-fixed">
          <TableHeader className="bg-background top-0 sticky">
            <TableRow>
              <TableHead className="w-[200px]">File</TableHead>
              <TableHead className="">Input</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(run.workflow_inputs).map(([key, data]) => {
              let imageUrl;
              try {
                const url = new URL(data);
                if (url.pathname.endsWith('.png')) {
                  imageUrl = data;
                }
              } catch (_) {
              }
              return (
                <TableRow key={key}>
                  <TableCell>{key}</TableCell>
                  {imageUrl ? <TableCell><img className="w-[200px] aspect-square object-contain" src={imageUrl}></img></TableCell> : <TableCell>{data}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}
