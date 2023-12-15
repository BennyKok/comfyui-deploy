import { parseDataSafe } from "../../../lib/parseDataSafe";
import { createRun } from "../../../server/createRun";
import { db } from "@/db/db";
import { deploymentsTable } from "@/db/schema";
import { getRunsData } from "@/server/getRunsOutput";
import { replaceCDNUrl } from "@/server/resource";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const Request = z.object({
  deployment_id: z.string(),
  inputs: z.record(z.string()).optional(),
});

const Request2 = z.object({
  run_id: z.string(),
});

export async function GET(request: Request) {
  const [data, error] = await parseDataSafe(Request2, request);
  if (!data || error) return error;

  const run = await getRunsData(data.run_id);

  if (run?.status === "success" && run?.outputs?.length > 0) {
    for (let i = 0; i < run.outputs.length; i++) {
      const output = run.outputs[i];

      if (output.data?.images === undefined) continue;

      for (let j = 0; j < output.data?.images.length; j++) {
        const element = output.data?.images[j];
        element.url = replaceCDNUrl(
          `${process.env.SPACES_ENDPOINT}/comfyui-deploy/outputs/runs/${run.id}/${element.filename}`
        );
      }
    }
  }

  return NextResponse.json(run, {
    status: 200,
  });
}

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  const origin = new URL(request.url).origin;

  const { deployment_id, inputs } = data;

  try {
    const deploymentData = await db.query.deploymentsTable.findFirst({
      where: eq(deploymentsTable.id, deployment_id),
    });

    if (!deploymentData) throw new Error("Deployment not found");

    const run_id = await createRun(
      origin,
      deploymentData.workflow_version_id,
      deploymentData.machine_id,
      inputs
    );

    return NextResponse.json(
      {
        run_id: run_id,
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
