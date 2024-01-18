import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { findAllRuns } from "@/server/findAllRuns";

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
              let imageUrl: string | undefined;
              try {
                if (typeof data === "string") {
                  if (data.startsWith("data:image/")) {
                    imageUrl = data;
                  } else {
                    const url = new URL(data);
                    if (url.pathname.endsWith(".png")) {
                      imageUrl = data;
                    }
                  }
                }
              } catch (_) {}
              return (
                <TableRow key={key}>
                  <TableCell>{key}</TableCell>
                  {imageUrl ? (
                    <TableCell>
                      <img
                        className="w-[200px] aspect-square object-contain"
                        src={imageUrl}
                      />
                    </TableCell>
                  ) : (
                    <TableCell>{data}</TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}
