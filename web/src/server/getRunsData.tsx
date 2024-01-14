import { db } from "@/db/db";
import { workflowRunsTable } from "@/db/schema";
import type { APIKeyUserType } from "@/server/APIKeyBodyRequest";
import { replaceCDNUrl } from "@/server/replaceCDNUrl";
import { and, eq } from "drizzle-orm";

export async function getRunsData(run_id: string, user?: APIKeyUserType) {
  const data = await db.query.workflowRunsTable.findFirst({
    where: and(eq(workflowRunsTable.id, run_id)),
    with: {
      workflow: {
        columns: {
          org_id: true,
          user_id: true,
        },
      },
      outputs: {
        columns: {
          data: true,
        },
      },
    },
  });

  if (!data) {
    return null;
  }

  if (user) {
    if (user.org_id) {
      // is org api call, check org only
      if (data.workflow.org_id != user.org_id) {
        return null;
      }
    } else {
      // is user api call, check user only
      if (
        data.workflow.user_id != user.user_id &&
        data.workflow.org_id == null
      ) {
        return null;
      }
    }
  }

  if (data) {
    // Fill in the CDN url
    if (data?.status === "success" && data?.outputs?.length > 0) {
      for (let i = 0; i < data.outputs.length; i++) {
        const output = data.outputs[i];

        if (output.data?.images !== undefined) {
          for (let j = 0; j < output.data?.images.length; j++) {
            const element = output.data?.images[j];
            element.url = replaceCDNUrl(
              `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}/outputs/runs/${data.id}/${element.filename}`
            );
          }
        } else if (output.data?.files !== undefined) {
          for (let j = 0; j < output.data?.files.length; j++) {
            const element = output.data?.files[j];
            element.url = replaceCDNUrl(
              `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}/outputs/runs/${data.id}/${element.filename}`
            );
          }
        }
      }
    }
  }

  return data;
}
