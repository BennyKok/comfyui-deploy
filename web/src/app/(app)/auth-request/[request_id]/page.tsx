import { ButtonAction } from "@/components/ButtonActionLoader";
import { Button } from "@/components/ui/button";
import { createAuthRequest } from "@/server/curdApiKeys";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getOrgOrUserDisplayName } from "../../../../server/getOrgOrUserDisplayName";
import { db } from "@/db/db";
import { eq } from "drizzle-orm";
import { authRequestsTable } from "@/db/schema";

export default async function Home({
  params,
}: {
  params: { request_id: string };
}) {
  const { userId, orgId } = await auth();

  if (!userId) redirect("/");

  if (!params.request_id)
    return (
      <div className="h-full w-full flex flex-col gap-2 items-center justify-center">
        No valid request_id
      </div>
    );

  const existingResult = await db.query.authRequestsTable.findFirst({
    where: eq(authRequestsTable.request_id, params.request_id),
  });

  if (existingResult?.api_hash) {
    return (
      <div className="h-full w-full flex flex-col gap-2 items-center justify-center">
        Request already consumed.
      </div>
    );
  }

  const userName = await getOrgOrUserDisplayName(orgId, userId);

  return (
    <div className="h-full w-full flex flex-col gap-2 items-center justify-center">
      <div className="text-lg">Grant API Access to {userName}</div>
      <Button asChild>
        <ButtonAction
          routerAction="do-nothing"
          action={createAuthRequest.bind(null, params.request_id)}
        >
          Grant Access
        </ButtonAction>
      </Button>
    </div>
  );
}
