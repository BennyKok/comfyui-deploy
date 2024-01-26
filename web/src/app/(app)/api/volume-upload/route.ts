import { parseDataSafe } from "../../../../lib/parseDataSafe";
import { db } from "@/db/db";
import { modelTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const Request = z.object({
  volume_id: z.string(),
  model_id: z.string(),
  folder_path: z.string().optional(),
  status: z.enum(["success", "failed"]),
  error_log: z.string().optional(),
  timeout: z.number().optional(),
});

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  const { model_id, error_log, status, folder_path } = data;
  console.log(model_id, error_log, status, folder_path);

  if (status === "success") {
    await db
      .update(modelTable)
      .set({
        status: "success",
        folder_path,
        updated_at: new Date(),
        // build_log: build_log,
      })
      .where(eq(modelTable.id, model_id));
  } else {
    await db
      .update(modelTable)
      .set({
        status: "failed",
        error_log,
        updated_at: new Date(),
        // status: "error",
        // build_log: build_log,
      })
      .where(eq(modelTable.id, model_id));
  }

  return NextResponse.json(
    {
      message: "success",
    },
    {
      status: 200,
    },
  );
}
