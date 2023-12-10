import { parseDataSafe } from "../../../lib/parseDataSafe";
import { db } from "@/db/db";
import { workflowRunsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const Request = z.object({
  workflow_version_id: z.string(),
  // workflow_version: z.number().optional(),
  machine_id: z.string(),
});

const ComfyAPI_Run = z.object({
  prompt_id: z.string(),
  number: z.number(),
  node_errors: z.any(),
});

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  const origin = new URL(request.url).origin;

  const { workflow_version_id, machine_id } = data;

  const machine = await db.query.machinesTable.findFirst({
    where: eq(workflowRunsTable.id, machine_id),
  });

  if (!machine) {
    return new Response("Machine not found", {
      status: 404,
    });
  }

  const workflow_version_data =
    // workflow_version_id
    //   ?
    await db.query.workflowVersionTable.findFirst({
      where: eq(workflowRunsTable.id, workflow_version_id),
    });
  // : workflow_version != undefined
  // ? await db.query.workflowVersionTable.findFirst({
  //     where: and(
  //       eq(workflowVersionTable.version, workflow_version),
  //       eq(workflowVersionTable.workflow_id)
  //     ),
  //   })
  // : null;

  if (!workflow_version_data) {
    return new Response("Workflow version not found", {
      status: 404,
    });
  }

  const comfyui_endpoint = `${machine.endpoint}/comfy-deploy/run`;

  // Sending to comfyui
  const result = await fetch(comfyui_endpoint, {
    method: "POST",
    // headers: {
    //   "Content-Type": "application/json",
    // },
    body: JSON.stringify({
      workflow_api: workflow_version_data.workflow_api,
      status_endpoint: `${origin}/api/update-run`,
    }),
  })
    .then(async (res) => ComfyAPI_Run.parseAsync(await res.json()))
    .catch((error) => {
      console.error(error);
      return new Response(error.details, {
        status: 500,
      });
    });

  // return the error
  if (result instanceof Response) {
    return result;
  }

  // Add to our db
  const workflow_run = await db
    .insert(workflowRunsTable)
    .values({
      id: result.prompt_id,
      workflow_version_id: workflow_version_data.id,
      machine_id,
    })
    .returning();

  revalidatePath(`./${workflow_version_data.workflow_id}`);

  return NextResponse.json(
    {
      workflow_run_id: workflow_run[0].id,
    },
    {
      status: 200,
    }
  );
}
