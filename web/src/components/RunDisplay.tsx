"use client";

import type { findAllRuns } from "../app/[workflow_id]/page";
import { StatusBadge } from "../app/[workflow_id]/page";
import { useStore } from "@/components/MachinesWS";
import { TableCell, TableRow } from "@/components/ui/table";
import { getRelativeTime } from "@/lib/getRelativeTime";

export function RunDisplay({
  run,
}: {
  run: Awaited<ReturnType<typeof findAllRuns>>[0];
}) {
  const data = useStore((state) => state.data.find((x) => x.id === run.id));

  return (
    <TableRow>
      <TableCell>{run.version.version}</TableCell>
      <TableCell className="font-medium">{run.machine.name}</TableCell>
      <TableCell>{getRelativeTime(run.created_at)}</TableCell>
      <TableCell>{data ? data.json.event : "-"}</TableCell>
      <TableCell className="text-right">
        <StatusBadge run={run} />
      </TableCell>
    </TableRow>
  );
}
