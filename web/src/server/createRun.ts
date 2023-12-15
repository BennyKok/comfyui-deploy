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

  const workflow_api = workflow_version_data.workflow_api;

  // Replace the inputs
  if (inputs && workflow_api) {
    for (const key in inputs) {
      Object.entries(workflow_api).forEach(([_, node]) => {
        if (node.inputs["input_id"] === key) {
          node.inputs["input_id"] = inputs[key];
        }
      });
    }
  }

  const body = {
    workflow_api: workflow_api,
    status_endpoint: `${origin}/api/update-run`,
    file_upload_endpoint: `${origin}/api/file-upload`,
  };
  // console.log(body);
  const bodyJson = JSON.stringify(body);
  // console.log(bodyJson);

  // Sending to comfyui
  const _result = await fetch(comfyui_endpoint, {
    method: "POST",
    body: bodyJson,
    cache: "no-store",
  });

  if (!_result.ok) {
    throw new Error(`Error creating run, ${_result.statusText}`);
  }

  console.log(_result);

  const result = await ComfyAPI_Run.parseAsync(await _result.json());

  console.log(result);

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

  return {
    workflow_run_id: workflow_run[0].id,
    message: "Successfully workflow run",
  };
}
