import { z } from "zod";

export const ComfyAPI_Run = z.object({
  prompt_id: z.string(),
  number: z.number(),
  node_errors: z.any(),
});
