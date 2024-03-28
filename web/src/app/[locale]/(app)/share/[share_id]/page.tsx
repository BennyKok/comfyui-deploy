import { ButtonActionMenu } from "@/components/ButtonActionLoader";
import { RunWorkflowInline } from "@/components/RunWorkflowInline";
import { PublicRunOutputs } from "@/components/VersionSelect";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { getInputsFromWorkflow } from "@/lib/getInputsFromWorkflow";
import { getRelativeTime } from "@/lib/getRelativeTime";
import { setInitialUserData } from "@/lib/setInitialUserData";
import {
	cloneMachine,
	cloneWorkflow,
	findSharedDeployment,
} from "@/server/curdDeploments";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export const maxDuration = 300; // 5 minutes

export default async function Page({
	params,
}: {
	params: { share_id: string };
}) {
	const { userId } = await auth();

	// If there is user, check if the user data is present
	if (userId) {
		const user = await db.query.usersTable.findFirst({
			where: eq(usersTable.id, userId),
		});

		if (!user) {
			await setInitialUserData(userId);
		}
	}

	const sharedDeployment = await findSharedDeployment(params.share_id);

	if (!sharedDeployment) return redirect("/");

	const userName = sharedDeployment.workflow.org_id
		? await clerkClient.organizations
				.getOrganization({
					organizationId: sharedDeployment.workflow.org_id,
				})
				.then((x) => x.name)
		: sharedDeployment.user.name;

	const inputs = getInputsFromWorkflow(sharedDeployment.version);

	return (
		<div className="mt-4 w-full grid grid-rows-[1fr,1fr] lg:grid-cols-[minmax(auto,500px),1fr] gap-4 max-h-[calc(100dvh-100px)]">
			<Card className="w-full h-fit mt-4">
				<CardHeader>
					<CardTitle className="flex justify-between items-center">
						<div>
							{userName}
							{" / "}
							{sharedDeployment.workflow.name}
						</div>

						<ButtonActionMenu
							title="Clone"
							actions={[
								{
									title: "Workflow",
									action: cloneWorkflow.bind(null, sharedDeployment.id),
								},
								{
									title: "Machine",
									action: cloneMachine.bind(null, sharedDeployment.id),
								},
							]}
						/>
					</CardTitle>
					<CardDescription suppressHydrationWarning={true}>
						{getRelativeTime(sharedDeployment?.updated_at)}
					</CardDescription>
				</CardHeader>

				<CardContent>
					<div>
						{sharedDeployment?.description && sharedDeployment?.description}
					</div>
					<RunWorkflowInline
						inputs={inputs}
						machine_id={sharedDeployment.machine_id}
						workflow_version_id={sharedDeployment.workflow_version_id}
					/>
				</CardContent>
			</Card>
			<Card className="w-full h-fit mt-4">
				<CardHeader>
					<CardDescription>Run outputs</CardDescription>
				</CardHeader>

				<CardContent>
					<PublicRunOutputs preview={sharedDeployment.showcase_media} />
				</CardContent>
			</Card>
		</div>
	);
}
