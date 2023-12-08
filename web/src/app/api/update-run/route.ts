import { parseDataSafe } from "../../../lib/parseDataSafe";
import { db } from "@/db/db";
import {
  workflowRunStatus,
  workflowRunsTable,
  workflowTable,
  workflowVersionTable,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodFormattedError, z } from "zod";

const Request = z.object({
  run_id: z.string(),
  status: z.enum(["not-started", "running", "success", "failed"]),
});

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  let { run_id, status } = data;

  const workflow_run = await db
    .update(workflowRunsTable)
    .set({
      status: status,
    })
    .where(eq(workflowRunsTable.id, run_id));

  return NextResponse.json(
    {
      message: "success",
    },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    },
  );
}
