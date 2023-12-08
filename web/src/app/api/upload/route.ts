import { parseDataSafe } from "../../../lib/parseDataSafe";
import { db } from "@/db/db";
import { workflowTable, workflowVersionTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodFormattedError, z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const UploadRequest = z.object({
  user_id: z.string(),
  workflow_id: z.string().optional(),
  workflow_name: z.string().optional(),
  workflow: z.any(),
  workflow_api: z.any(),
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
  console.log("hi");

  const [data, error] = await parseDataSafe(
    UploadRequest,
    request,
    corsHeaders,
  );

  if (!data || error) return error;

  let { user_id, workflow, workflow_api, workflow_id, workflow_name } = data;

  let version = -1;

  // Case 1 new workflow
  try {
    if ((!workflow_id || workflow_id.length == 0) && workflow_name) {
      // Create a new parent workflow
      const workflow = await db
        .insert(workflowTable)
        .values({
          user_id,
          name: workflow_name,
        })
        .returning();

      workflow_id = workflow[0].id;

      // Create a new version
      const data = await db
        .insert(workflowVersionTable)
        .values({
          workflow_id: workflow_id,
          workflow,
          workflow_api,
          version: 1,
        })
        .returning();
      version = data[0].version;
    } else if (workflow_id) {
      // Case 2 update workflow
      const data = await db
        .insert(workflowVersionTable)
        .values({
          workflow_id,
          workflow,
          workflow_api,
          // version: sql`${workflowVersionTable.version} + 1`,
          version: sql`(
        SELECT COALESCE(MAX(version), 0) + 1
        FROM ${workflowVersionTable}
        WHERE workflow_id = ${workflow_id}
      )`,
        })
        .returning();
      version = data[0].version;
    } else {
      return NextResponse.json(
        {
          error: "Invalid request, missing either workflow_id or name",
        },
        {
          status: 500,
          statusText: "Invalid request",
          headers: corsHeaders,
        },
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.toString(),
      },
      {
        status: 500,
        statusText: "Invalid request",
        headers: corsHeaders,
      },
    );
  }

  return NextResponse.json(
    {
      workflow_id: workflow_id,
      version: version,
    },
    {
      status: 200,
      headers: corsHeaders,
    },
  );
}
