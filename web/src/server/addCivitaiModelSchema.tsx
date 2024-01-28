import { z } from "zod";
import { modelTypes } from "@/db/schema";

export const downloadUrlModelSchema = z.object({
  url: z.string().url(),
  model_type: z.enum(modelTypes).default("checkpoint")
});

