import { parseDataSafe } from "../../../../lib/parseDataSafe";
import { db } from "@/db/db";
import { checkpointTable, machinesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const Request = z.object({
  volume_id: z.string(),
  checkpoint_id: z.string(),
  folder_path: z.string().optional(),
  status: z.enum(['success', 'failed']),
  error_log: z.string().optional(),
  timeout: z.number().optional(),
});

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  const { checkpoint_id, error_log, status, folder_path } = data;

  if (status === "success") {
    await db
      .update(checkpointTable)
      .set({
        status: "success",
        folder_path 
        // build_log: build_log,
      })
      .where(eq(checkpointTable.id, checkpoint_id));
  } else {
    // console.log(data);
    await db
      .update(checkpointTable)
      .set({
        status: "failed",
        error_log, 
        // status: "error",
        // build_log: build_log,
      })
      .where(eq(checkpointTable.id, checkpoint_id));
  }

  return NextResponse.json(
    {
      message: "success",
    },
    {
      status: 200,
    }
  );
}
