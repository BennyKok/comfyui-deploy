import { parseDataSafe } from "../../../lib/parseDataSafe";
import { createRun } from "../../../server/createRun";
import { NextResponse } from "next/server";
import { z } from "zod";

const Request = z.object({
  workflow_version_id: z.string(),
  // workflow_version: z.number().optional(),
  machine_id: z.string(),
});

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  const origin = new URL(request.url).origin;

  const { workflow_version_id, machine_id } = data;

  try {
    const workflow_run_id = await createRun(
      origin,
      workflow_version_id,
      machine_id
    );

    return NextResponse.json(
      {
        workflow_run_id: workflow_run_id,
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
