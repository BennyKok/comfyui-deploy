"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OutputRender } from "./OutputRender";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { findAllRuns } from "@/server/findAllRuns";
import { getRunsOutput } from "@/server/getRunsOutput";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { LogsViewer } from "@/components/LogsViewer";
import { CopyButton } from "@/components/CopyButton";
import useSWR from "swr";
import { CodeBlockClient } from "@/components/CodeBlockClient";

export function RunOutputs({
  run,
}: { run: Awaited<ReturnType<typeof findAllRuns>>[0] }) {
  const { data, isValidating, error } = useSWR(
    "run-outputs+" + run.id,
    async () => {
      return await getRunsOutput(run.id);
    },
  );

  return (
    <Table className="table-fixed">
      <TableHeader className="bg-background top-0 sticky">
        <TableRow>
          <TableHead className="w-[200px]">File</TableHead>
          <TableHead className="">Output</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow key={run.id}>
          <TableCell className="break-words">Run log</TableCell>
          <TableCell>
            {run.run_log ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="w-fit">
                    View Log <ExternalLink size={14} />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[1000px] h-full max-h-[600px] grid grid-rows-[auto,1fr,auto]">
                  <DialogHeader>
                    <DialogTitle>Run Log</DialogTitle>
                  </DialogHeader>
                  <LogsViewer logs={run.run_log} stickToBottom={false} />
                  <DialogFooter>
                    <CopyButton
                      className="w-fit aspect-auto p-4"
                      text={JSON.stringify(run.run_log)}
                    >
                      Copy
                    </CopyButton>
                    <DialogClose>
                      <Button type="button" variant="secondary">
                        Close
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              "No log available"
            )}
          </TableCell>
        </TableRow>

        {data?.map((run) => {
          const fileName =
            run.data.images?.[0].filename ||
            run.data.files?.[0].filename ||
            run.data.gifs?.[0].filename;

          if (!fileName)
            return (
              <TableRow key={run.id}>
                <TableCell>Output</TableCell>
                <TableCell className="">
                  <CodeBlockClient
                    code={JSON.stringify(run.data, null, 2)}
                    lang="json"
                  />
                </TableCell>
              </TableRow>
            );

          // const filePath
          return (
            <TableRow key={run.id}>
              <TableCell className="break-words">{fileName}</TableCell>
              <TableCell>
                <OutputRender run_id={run.run_id} filename={fileName} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
