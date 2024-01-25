import { z } from "zod";

// from chatgpt https://chat.openai.com/share/4985d20b-30b1-4a28-87f6-6ebf84a1040e

export const creatorSchema = z.object({
  username: z.string().nullish(),
  image: z.string().url().nullish(),
});

export const fileMetadataSchema = z.object({
  fp: z.string().nullish(),
  size: z.string().nullish(),
  format: z.string().nullish(),
});

export const fileSchema = z.object({
  id: z.number(),
  sizeKB: z.number().nullish(),
  name: z.string(),
  type: z.string().nullish(),
  metadata: fileMetadataSchema.nullish(),
  pickleScanResult: z.string().nullish(),
  pickleScanMessage: z.string().nullable(),
  virusScanResult: z.string().nullish(),
  virusScanMessage: z.string().nullable(),
  scannedAt: z.string().nullish(),
  hashes: z.record(z.string()).nullish(),
  downloadUrl: z.string().url(),
  primary: z.boolean().nullish(),
});

export const imageMetadataSchema = z.object({
  hash: z.string(),
  width: z.number(),
  height: z.number(),
});

export const imageMetaSchema = z.object({
  ENSD: z.string().nullish(),
  Size: z.string().nullish(),
  seed: z.number().nullish(),
  Model: z.string().nullish(),
  steps: z.number().nullish(),
  hashes: z.record(z.string()).nullish(),
  prompt: z.string().nullish(),
  sampler: z.string().nullish(),
  cfgScale: z.number().nullish(),
  ClipSkip: z.number().nullish(),
  resources: z.array(
    z.object({
      hash: z.string().nullish(),
      name: z.string(),
      type: z.string(),
      weight: z.number().nullish(),
    }),
  ).nullish(),
  ModelHash: z.string().nullish(),
  HiresSteps: z.string().nullish(),
  HiresUpscale: z.string().nullish(),
  HiresUpscaler: z.string().nullish(),
  negativePrompt: z.string(),
  DenoisingStrength: z.number().nullish(),
});

// NOTE: this definition is all over the place
// export const imageSchema = z.object({
//   url: z.string().url().nullish(),
//   nsfw: z.enum(["None", "Soft", "Mature"]).nullish(),
//   width: z.number().nullish(),
//   height: z.number().nullish(),
//   hash: z.string().nullish(),
//   type: z.string().nullish(),
//   metadata: imageMetadataSchema.nullish(),
//   meta: imageMetaSchema.nullish(),
// });

export const modelVersionSchema = z.object({
  id: z.number(),
  modelId: z.number(),
  name: z.string(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  // status: z.enum(["Published", "Unpublished"]).nullish(),
  status: z.string().nullish(),
  publishedAt: z.string().nullish(),
  trainedWords: z.array(z.string()).nullable(),
  trainingStatus: z.string().nullable(),
  trainingDetails: z.string().nullable(),
  baseModel: z.string().nullish(),
  baseModelType: z.string().nullish(),
  earlyAccessTimeFrame: z.number().nullish(),
  description: z.string().nullable(),
  vaeId: z.number().nullable(),
  stats: z.object({
    downloadCount: z.number(),
    ratingCount: z.number(),
    rating: z.number(),
  }).nullish(),
  files: z.array(fileSchema),
  images: z.array(z.any()).nullish(),
  downloadUrl: z.string().url(),
});

export const statsSchema = z.object({
  downloadCount: z.number(),
  favoriteCount: z.number(),
  commentCount: z.number(),
  ratingCount: z.number(),
  rating: z.number(),
  tippedAmountCount: z.number(),
});

export const CivitaiModelResponse = z.object({
  id: z.number(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  // type: z.enum(["Checkpoint", "Lora"]), // TODO: this will be important to know
  type: z.string(),
  poi: z.boolean().nullish(),
  nsfw: z.boolean().nullish(),
  allowNoCredit: z.boolean().nullish(),
  allowCommercialUse: z.string().nullish(),
  allowDerivatives: z.boolean().nullish(),
  allowDifferentLicense: z.boolean().nullish(),
  stats: statsSchema.nullish(),
  creator: creatorSchema.nullish(),
  tags: z.array(z.string()).nullish(),
  modelVersions: z.array(modelVersionSchema),
});
