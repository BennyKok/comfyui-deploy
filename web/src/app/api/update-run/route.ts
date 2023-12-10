import { parseDataSafe } from "../../../lib/parseDataSafe";
import { db } from "@/db/db";
import { workflowRunsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const Request = z.object({
  run_id: z.string(),
  status: z.enum(["not-started", "running", "success", "failed"]),
});

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  const { run_id, status } = data;

  const workflow_run = await db
    .update(workflowRunsTable)
    .set({
      status: status,
    })
    .where(eq(workflowRunsTable.id, run_id))
    .returning();

  const workflow_version = await db.query.workflowVersionTable.findFirst({
    where: eq(workflowRunsTable.id, workflow_run[0].workflow_version_id),
  });

  revalidatePath(`./${workflow_version?.workflow_id}`);

  return NextResponse.json(
    {
      message: "success",
    },
    {
      status: 200,
    }
  );
}
