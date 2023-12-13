"use client";

import { useStore } from "@/components/MachinesWS";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRelativeTime } from "@/lib/getRelativeTime";
import { type findAllRuns } from "@/server/findAllRuns";
import { getRunsOutput } from "@/server/getRunsOutput";
import { useEffect, useState } from "react";

export function RunDisplay({
  run,
}: {
  run: Awaited<ReturnType<typeof findAllRuns>>[0];
}) {
  const data = useStore(
    (state) =>
      state.data
        .filter((x) => x.id === run.id)
        .sort((a, b) => b.timestamp - a.timestamp)?.[0]
  );

  let status = run.status;

  if (data?.json.event == "executing" && data.json.data.node == undefined) {
    status = "success";
  } else if (data?.json.event == "executing") {
    status = "running";
  }

  return (
    <Dialog>
      <DialogTrigger asChild className="appearance-none hover:cursor-pointer">
        <TableRow>
          <TableCell>{run.version?.version}</TableCell>
          <TableCell className="font-medium">{run.machine?.name}</TableCell>
          <TableCell>{getRelativeTime(run.created_at)}</TableCell>
          <TableCell>
            {data && status != "success"
              ? `${data.json.event} - ${data.json.data.node}`
              : "-"}
          </TableCell>
          <TableCell className="text-right">
            <StatusBadge status={status} />
          </TableCell>
        </TableRow>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run outputs</DialogTitle>
          <DialogDescription>
            You can view your run&apos;s outputs here
          </DialogDescription>
        </DialogHeader>
        <RunOutputs run_id={run.id} />
      </DialogContent>
    </Dialog>
  );
}

export function RunOutputs({ run_id }: { run_id: string }) {
  const [outputs, setOutputs] = useState<
    Awaited<ReturnType<typeof getRunsOutput>>
  >([]);

  useEffect(() => {
    getRunsOutput(run_id).then((x) => setOutputs(x));
  }, [run_id]);

  return (
    <Table>
      {/* <TableCaption>A list of your recent runs.</TableCaption> */}
      <TableHeader className="bg-background top-0 sticky">
        <TableRow>
          <TableHead className="w-[100px]">File</TableHead>
          <TableHead className="">Output</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {outputs?.map((run) => {
          const fileName = run.data.images[0].filename;
          // const filePath
          return (
            <TableRow key={run.id}>
              <TableCell>{fileName}</TableCell>
              <TableCell>
                <OutputRender run_id={run_id} filename={fileName} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function OutputRender(props: { run_id: string; filename: string }) {
  if (props.filename.endsWith(".png")) {
    return (
      <img
        alt={props.filename}
        src={`api/view?file=${encodeURIComponent(
          `outputs/runs/${props.run_id}/${props.filename}`
        )}`}
      />
    );
  }
}
