"use server";

import { db } from "@/db/db";
import { workflowRunsTable } from "@/db/schema";
import { ComfyAPI_Run } from "@/types/ComfyAPI_Run";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import "server-only";

export async function createRun(
  origin: string,
  workflow_version_id: string,
  machine_id: string,
  inputs?: Record<string, string>
) {
  const machine = await db.query.machinesTable.findFirst({
    where: eq(workflowRunsTable.id, machine_id),
  });

  if (!machine) {
    throw new Error("Machine not found");
    // return new Response("Machine not found", {
    //   status: 404,
    // });
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
    throw new Error("Workflow version not found");
    // return new Response("Workflow version not found", {
    //   status: 404,
    // });
  }

  const comfyui_endpoint = `${machine.endpoint}/comfyui-deploy/run`;

  let workflow_api = workflow_version_data.workflow_api;

  // Replace the inputs
  if (inputs) {
    for (const key in inputs) {
      workflow_api = workflow_api.replace(`"${key}"`, `"${inputs[key]}"`);
    }
  }

  // Sending to comfyui
  const result = await fetch(comfyui_endpoint, {
    method: "POST",
    // headers: {
    //   "Content-Type": "application/json",
    // },
    body: JSON.stringify({
      workflow_api: workflow_api,
      status_endpoint: `${origin}/api/update-run`,
      file_upload_endpoint: `${origin}/api/file-upload`,
      inputs: inputs,
    }),
  }).then(async (res) => ComfyAPI_Run.parseAsync(await res.json()));
  // .catch((error) => {
  //   console.error(error);
  //   return new Response(error.details, {
  //     status: 500,
  //   });
  // });

  // console.log(result);

  // // return the error
  // if (result instanceof Response) {
  //   return result;
  // }

  // Add to our db
  const workflow_run = await db
    .insert(workflowRunsTable)
    .values({
      id: result.prompt_id,
      workflow_id: workflow_version_data.workflow_id,
      workflow_version_id: workflow_version_data.id,
      workflow_inputs: inputs,
      machine_id,
    })
    .returning();

  revalidatePath(`/${workflow_version_data.workflow_id}`);

  return workflow_run[0].id;

  // return NextResponse.json(
  //   {
  //     workflow_run_id: workflow_run[0].id,
  //   },
  //   {
  //     status: 200,
  //   }
  // );
}
