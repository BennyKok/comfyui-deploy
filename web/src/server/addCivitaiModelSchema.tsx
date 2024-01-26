import { insertCivitaiModelSchema } from "@/db/schema";

export const addCivitaiModelSchema = insertCivitaiModelSchema.pick({
  civitai_url: true,
});
