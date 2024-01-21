"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { getRelativeTime } from "@/lib/getRelativeTime";
import type { findAllDeployments } from "@/server/findAllRuns";
import { useRouter } from "next/navigation";

export function SharePageDeploymentRow({
	deployment,
}: {
	deployment: Awaited<ReturnType<typeof findAllDeployments>>[0];
}) {
	const router = useRouter();
	return (
		<TableRow
			className="appearance-none hover:cursor-pointer"
			onClick={() => {
				if (deployment.environment === "public-share") {
					router.push(
						`/share/${deployment.share_slug ?? deployment.id}/settings`,
					);
				}
			}}
		>
			<TableCell className="capitalize truncate">
				{deployment.environment}
			</TableCell>
			<TableCell className="font-medium truncate">
				{deployment.version?.version}
			</TableCell>
			<TableCell className="font-medium truncate">
				{deployment.machine?.name}
			</TableCell>
			<TableCell className="text-right truncate">
				{getRelativeTime(deployment.updated_at)}
			</TableCell>
		</TableRow>
	);
}

export function DeploymentRow({
	deployment,
}: {
	deployment: Awaited<ReturnType<typeof findAllDeployments>>[0];
}) {
	return (
		<>
			<TableCell className="capitalize truncate">
				{deployment.environment}
			</TableCell>
			<TableCell className="font-medium truncate">
				{deployment.version?.version}
			</TableCell>
			<TableCell className="font-medium truncate">
				{deployment.machine?.name}
			</TableCell>
			<TableCell className="text-right truncate">
				{getRelativeTime(deployment.updated_at)}
			</TableCell>
		</>
	);
}
