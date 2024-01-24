"use client";
import { LoadingIcon } from "@/components/LoadingIcon";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createDeployments } from "@/server/curdDeploments";
import type { getMachines } from "@/server/curdMachine";
import type { findFirstTableWithVersion } from "@/server/findFirstTableWithVersion";
import { Share } from "lucide-react";
import { parseAsInteger, useQueryState } from "next-usequerystate";
import { useState } from "react";
import { useSelectedMachine } from "./VersionSelect";
import { callServerPromise } from "./callServerPromise";

export function CreateShareButton({
	workflow,
	machines,
}: {
	workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
	machines: Awaited<ReturnType<typeof getMachines>>;
}) {
	const [version] = useQueryState("version", {
		defaultValue: workflow?.versions[0].version ?? 1,
		...parseAsInteger,
	});
	const [machine] = useSelectedMachine(machines);

	const [isLoading, setIsLoading] = useState(false);
	const workflow_version_id = workflow?.versions.find(
		(x) => x.version == version,
	)?.id;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button className="gap-2" disabled={isLoading} variant="outline">
					Share {isLoading ? <LoadingIcon /> : <Share size={14} />}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56">
				<DropdownMenuItem
					onClick={async () => {
						if (!workflow_version_id) return;

						setIsLoading(true);
						await callServerPromise(
							createDeployments(
								workflow.id,
								workflow_version_id,
								machine,
								"public-share",
							),
						);
						setIsLoading(false);
					}}
				>
					Public
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
