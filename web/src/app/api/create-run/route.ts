import { parseDataSafe } from "../../../lib/parseDataSafe";
import { createRun } from "../../../server/createRun";
import { getRunsOutput } from "@/server/getRunsOutput";
import { NextResponse } from "next/server";
import { z } from "zod";

const Request = z.object({
  workflow_version_id: z.string(),
  machine_id: z.string(),
});

const Request2 = z.object({
  run_id: z.string(),
});

export async function GET(request: Request) {
  const [data, error] = await parseDataSafe(Request2, request);
  if (!data || error) return error;

  const run = await getRunsOutput(data.run_id);

  return NextResponse.json(run, {
    status: 200,
  });
}

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
        workflow_run_id: workflow_run_id.workflow_run_id,
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
