import { RunInputs } from "@/components/RunInputs";
import { RunOutputs } from "@/components/RunOutputs";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDuration, getRelativeTime } from "@/lib/getRelativeTime";
import { type findAllRuns } from "@/server/findAllRuns";
import { Suspense } from "react";
import { LiveStatus } from "./LiveStatus";

export async function RunDisplay({
	run,
}: {
	run: Awaited<ReturnType<typeof findAllRuns>>[0];
}) {
	return (
		<Dialog>
			<DialogTrigger asChild className="appearance-none hover:cursor-pointer">
				<TableRow>
					<TableCell>{run.number}</TableCell>
					<TableCell className="font-medium truncate">
						{run.machine?.name}
					</TableCell>
					<TableCell className="truncate">
						{getRelativeTime(run.created_at)}
					</TableCell>
					<TableCell>{run.version?.version}</TableCell>
					<TableCell>
						<Badge variant="outline" className="truncate">
							{run.origin}
						</Badge>
					</TableCell>
					<TableCell className="truncate">
						<Tooltip>
							<TooltipTrigger>{getDuration(run.duration)}</TooltipTrigger>
							<TooltipContent>
								<div>Cold start: {getDuration(run.cold_start_duration)}</div>
								<div>Run duration: {getDuration(run.run_duration)}</div>
							</TooltipContent>
						</Tooltip>
					</TableCell>
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
					<RunInputs run={run} />
					<Suspense>
						<RunOutputs run_id={run.id} />
					</Suspense>
				</div>
				{/* <div className="max-h-96 overflow-y-scroll">{view}</div> */}
			</DialogContent>
		</Dialog>
	);
}
