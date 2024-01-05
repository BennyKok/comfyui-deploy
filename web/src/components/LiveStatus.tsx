"use client";

import { useStore } from "@/components/MachinesWS";
import { StatusBadge } from "@/components/StatusBadge";
import { TableCell } from "@/components/ui/table";
import { type findAllRuns } from "@/server/findAllRuns";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveStatus({
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

  // const [view, setView] = useState<any>();
  // if (data?.json.event == "executing" && data.json.data.node == undefined) {
  //   status = "success";
  // } else
  if (data?.json.event == "executing") {
    if (data?.json?.data?.node == undefined) {
      status = "success";
    } else {
      status = "running";
    }
  } else if (data?.json.event == "uploading") {
    status = "uploading";
  } else if (data?.json.event == "success") {
    status = "success";
  } else if (data?.json.event == "failed") {
    status = "failed";
  }

  const router = useRouter();

  useEffect(() => {
    if (data?.json.event === "outputs_uploaded") {
      router.refresh();
    }
  }, [data?.json.event]);

  return (
    <>
      <TableCell>
        {data && status != "success"
          ? `${data.json.event} - ${data.json.data.node}`
          : "-"}
      </TableCell>
      <TableCell className="truncate text-right">
        <StatusBadge status={status} />
      </TableCell>
    </>
  );
}
