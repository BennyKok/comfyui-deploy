import type { WorkflowVersionType } from "@/db/schema";
import { getInputsFromWorkflow } from "@/lib/getInputsFromWorkflow";
import { z } from "zod";

export function workflowVersionInputsToZod(
  workflow_version: WorkflowVersionType
) {
  const inputs = getInputsFromWorkflow(workflow_version);
  return plainInputsToZod(inputs);
}

export function plainInputsToZod(
  inputs: ReturnType<typeof getInputsFromWorkflow>
) {
  if (!inputs) return null;

  return z.object({
    ...Object.fromEntries(
      inputs?.map((x) => {
        return [x?.input_id, z.string().optional()];
      })
    ),
  });
}
