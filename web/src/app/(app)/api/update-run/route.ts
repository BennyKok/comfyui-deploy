import { parseDataSafe } from "../../../../lib/parseDataSafe";
import { db } from "@/db/db";
import {
  userUsageTable,
  workflowRunOutputs,
  workflowRunsTable,
  workflowTable,
} from "@/db/schema";
import { getDuration } from "@/lib/getRelativeTime";
import { getSubscription, setUsage } from "@/server/linkToPricing";
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
    const workflow_run = await db
      .update(workflowRunsTable)
      .set({
        status: status,
        ended_at:
          status === "success" || status === "failed" ? new Date() : null,
      })
      .where(eq(workflowRunsTable.id, run_id));

    // get data from workflowRunsTable
    const userUsageTime = await importUserUsageData(run_id);

    if (userUsageTime) {
      // get the usage_time from userUsage
      await addSubscriptionUnit(userUsageTime);
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
    }
  );
}

async function addSubscriptionUnit(userUsageTime: number) {
  const subscription = await getSubscription();

  // round up userUsageTime to the nearest integer
  const roundedUsageTime = Math.ceil(userUsageTime);

  if (subscription) {
    const usage = await setUsage(
      subscription.data[0].attributes.first_subscription_item.id,
      roundedUsageTime
    );
  }
}

async function importUserUsageData(run_id: string) {
  const workflowRuns = await db.query.workflowRunsTable.findFirst({
    where: eq(workflowRunsTable.id, run_id),
  });

  if (!workflowRuns?.workflow_id) return;

  // find if workflowTable id column contains workflowRunsTable workflow_id
  const workflow = await db.query.workflowTable.findFirst({
    where: eq(workflowTable.id, workflowRuns.workflow_id),
  });

  if (workflowRuns?.ended_at === null || workflow == null) return;

  const usageTime = parseFloat(
    getDuration((workflowRuns?.ended_at - workflowRuns?.started_at) / 1000)
  );

  // add data to userUsageTable
  const user_usage = await db.insert(userUsageTable).values({
    user_id: workflow.user_id,
    created_at: workflowRuns.ended_at,
    org_id: workflow.org_id,
    ended_at: workflowRuns.ended_at,
    usage_time: usageTime,
  });

  return usageTime;
}
