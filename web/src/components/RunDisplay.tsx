"use client";

import { LiveStatus } from "./LiveStatus";
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
import { getRunsOutputDisplay } from "@/server/getRunsOutput";
import { useState } from "react";

export function RunDisplay({
  run,
}: {
  run: Awaited<ReturnType<typeof findAllRuns>>[0];
}) {
  const [view, setView] = useState<any>();
  return (
    <Dialog>
      <DialogTrigger
        asChild
        className="appearance-none hover:cursor-pointer"
        onClick={async () => {
          if (view) return;
          const _view = await getRunsOutputDisplay(run.id);
          setView(_view);
        }}
      >
        <TableRow>
          <TableCell>{run.version?.version}</TableCell>
          <TableCell className="font-medium">{run.machine?.name}</TableCell>
          <TableCell>{getRelativeTime(run.created_at)}</TableCell>
          <LiveStatus run={run} />
        </TableRow>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Run outputs</DialogTitle>
          <DialogDescription>
            You can view your run&apos;s outputs here
          </DialogDescription>
        </DialogHeader>
        {/* <Suspense>
          <RunOutputs run_id={run.id} />
        </Suspense> */}
        {view}
      </DialogContent>
    </Dialog>
  );
}

export function OutputRender(props: { run_id: string; filename: string }) {
  if (props.filename.endsWith(".png")) {
    return (
      <img
        alt={props.filename}
        src={`/api/view?file=${encodeURIComponent(
          `outputs/runs/${props.run_id}/${props.filename}`
        )}`}
      />
    );
  }
}
