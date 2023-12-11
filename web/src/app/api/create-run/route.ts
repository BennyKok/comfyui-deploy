import { parseDataSafe } from "../../../lib/parseDataSafe";
import { createRun } from "../../../server/createRun";
import { z } from "zod";

const Request = z.object({
  workflow_version_id: z.string(),
  // workflow_version: z.number().optional(),
  machine_id: z.string(),
});

export const ComfyAPI_Run = z.object({
  prompt_id: z.string(),
  number: z.number(),
  node_errors: z.any(),
});

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  const origin = new URL(request.url).origin;

  const { workflow_version_id, machine_id } = data;

  return await createRun(origin, workflow_version_id, machine_id);
}
