import { handleResourceUpload } from "@/server/resource";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseDataSafe } from "../../../../lib/parseDataSafe";

const Request = z.object({
  file_name: z.string(),
  run_id: z.string(),

  type: z.string(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  const { file_name, run_id, type } = data;

  try {
    const uploadUrl = await handleResourceUpload({
      resourceBucket: process.env.SPACES_BUCKET,
      resourceId: `outputs/runs/${run_id}/${file_name}`,
      resourceType: type,
      isPublic: true,
    });

    return NextResponse.json(
      {
        url: uploadUrl,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
