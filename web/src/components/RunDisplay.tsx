import { LiveStatus } from "./LiveStatus";
import { RunOutputs } from "@/components/RunOutputs";
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
import { Suspense } from "react";

export async function RunDisplay({
  run,
}: {
  run: Awaited<ReturnType<typeof findAllRuns>>[0];
}) {
  // const [view, setView] = useState<any>();
  return (
    <Dialog>
      <DialogTrigger
        asChild
        className="appearance-none hover:cursor-pointer"
        // onClick={async () => {
        //   if (view) return;
        //   const _view = await callServerPromise(getRunsOutputDisplay(run.id));
        //   setView(_view);
        // }}
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
        <div className="max-h-96 overflow-y-scroll">
          <Suspense>
            <RunOutputs run_id={run.id} />
          </Suspense>
        </div>
        {/* <div className="max-h-96 overflow-y-scroll">{view}</div> */}
      </DialogContent>
    </Dialog>
  );
}

export function OutputRender(props: { run_id: string; filename: string }) {
  if (props.filename.endsWith(".png")) {
    return (
      <img
        className="max-w-[200px]"
        alt={props.filename}
        src={`/api/view?file=${encodeURIComponent(
          `outputs/runs/${props.run_id}/${props.filename}`
        )}`}
      />
    );
  }
}
