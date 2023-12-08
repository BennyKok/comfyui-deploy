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
  workflow_version_id: z.string(),
  machine_id: z.string(),
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

  let { workflow_version_id, machine_id } = data;

  const workflow_run = await db
    .insert(workflowRunsTable)
    .values({
      workflow_version_id,
      machine_id,
    })
    .returning();

  return NextResponse.json(
    {
      workflow_run_id: workflow_run[0].id,
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
