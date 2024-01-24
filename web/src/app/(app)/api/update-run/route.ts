import { parseDataSafe } from "../../../../lib/parseDataSafe";
import { db } from "@/db/db";
import {
  userUsageTable,
  workflowRunOutputs,
  workflowRunsTable,
  workflowTable,
} from "@/db/schema";
import { getCurrentPlan } from "@/server/getCurrentPlan";
import { stripe } from "@/server/stripe";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const Request = z.object({
  run_id: z.string(),
  status: z
    .enum(["not-started", "running", "uploading", "success", "failed"])
    .optional(),
  output_data: z.any().optional(),
});

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  const { run_id, status, output_data } = data;

  // console.log(run_id, status, output_data);

  if (output_data) {
    const workflow_run_output = await db.insert(workflowRunOutputs).values({
      run_id: run_id,
      data: output_data,
    });
  } else if (status) {
    const [workflow_run] = await db
      .update(workflowRunsTable)
      .set({
        status: status,
        ended_at:
          status === "success" || status === "failed" ? new Date() : null,
      })
      .where(eq(workflowRunsTable.id, run_id))
      .returning();

    // Need to filter out only comfy deploy serverless
    // Also multiply with the gpu selection
    if (workflow_run.machine_type == "comfy-deploy-serverless") {
      if (
        (status === "success" || status === "failed") &&
        workflow_run.user_id
      ) {
        const sub = await getCurrentPlan({
          user_id: workflow_run.user_id,
          org_id: workflow_run.org_id,
        });

        if (sub && sub.subscription_item_api_id && workflow_run.ended_at) {
          let durationInSec = Math.abs(
            (workflow_run.ended_at.getTime() -
              workflow_run.created_at.getTime()) /
              1000,
          );
          durationInSec = Math.ceil(durationInSec);
          switch (workflow_run.gpu) {
            case "A100":
              durationInSec *= 7;
              break;
            case "A10G":
              durationInSec *= 4;
              break;
          }
          await stripe.subscriptionItems.createUsageRecord(
            sub.subscription_item_api_id,
            {
              quantity: durationInSec,
            },
          );
        }
      }
    }
  }

  // const workflow_version = await db.query.workflowVersionTable.findFirst({
  //   where: eq(workflowRunsTable.id, workflow_run[0].workflow_version_id),
  // });

  // revalidatePath(`./${workflow_version?.workflow_id}`);

  return NextResponse.json(
    {
      message: "success",
    },
    {
      status: 200,
    },
  );
}
