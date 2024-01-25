import { insertCivitaiCheckpointSchema } from "@/db/schema";

export const addCivitaiCheckpointSchema = insertCivitaiCheckpointSchema.pick({
  civitai_url: true,
});
