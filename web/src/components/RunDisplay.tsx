"use client";

import { RunOutputs } from "./RunOutputs";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { getRelativeTime } from "@/lib/getRelativeTime";
import { type findAllRuns } from "@/server/findAllRuns";

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
