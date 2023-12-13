import type { findAllRuns } from "../server/findAllRuns";
import { LoadingIcon } from "@/components/LoadingIcon";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({
  status,
}: {
  status: Awaited<ReturnType<typeof findAllRuns>>[0]["status"];
}) {
  switch (status) {
    case "running":
      return (
        <Badge variant="secondary">
          {status} <LoadingIcon />
        </Badge>
      );
    case "success":
      return <Badge variant="success">{status}</Badge>;
    case "failed":
      return <Badge variant="destructive">{status}</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}
