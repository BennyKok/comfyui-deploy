import { db } from "@/db/db";
import {
  checkpointTable,
} from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { and, desc, eq, isNull } from "drizzle-orm";

export async function getAllUserCheckpoints() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  const checkpoints = await db.query.checkpointTable.findMany({
    with: {
      user: {
        columns: {
          name: true,
        },
      },
    },
    columns: {
      id: true,
      updated_at: true,
      model_name: true,
      civitai_url: true,
      civitai_model_response: true,
      is_public: true,
      upload_type: true,
      status: true,
    },
    orderBy: desc(checkpointTable.updated_at),
    where: 
      orgId != undefined
        ? eq(checkpointTable.org_id, orgId)
        : and(eq(checkpointTable.user_id, userId), isNull(checkpointTable.org_id)),
  });

  return checkpoints;
}
