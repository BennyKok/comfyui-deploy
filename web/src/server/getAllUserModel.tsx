import { db } from "@/db/db";
import {
  modelTable,
} from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { and, desc, eq, isNull } from "drizzle-orm";

export async function getAllUserModels() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  const models = await db.query.modelTable.findMany({
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
      model_type: true,
      status: true,
    },
    orderBy: desc(modelTable.updated_at),
    where: 
      orgId != undefined
        ? eq(modelTable.org_id, orgId)
        : and(eq(modelTable.user_id, userId), isNull(modelTable.org_id)),
  });

  return models;
}
