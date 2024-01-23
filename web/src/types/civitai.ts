import { z } from 'zod';

// from chatgpt https://chat.openai.com/share/4985d20b-30b1-4a28-87f6-6ebf84a1040e

export const creatorSchema = z.object({
  username: z.string().optional(),
  image: z.string().url().optional(),
});

export const fileMetadataSchema = z.object({
  fp: z.string().optional(),
  size: z.string().optional(),
  format: z.string().optional(),
});

export const fileSchema = z.object({
  id: z.number(),
  sizeKB: z.number().optional(),
  name: z.string(),
  type: z.string().optional(),
  metadata: fileMetadataSchema.optional(),
  pickleScanResult: z.string().optional(),
  pickleScanMessage: z.string().nullable(),
  virusScanResult: z.string().optional(),
  virusScanMessage: z.string().nullable(),
  scannedAt: z.string().optional(),
  hashes: z.record(z.string()).optional(),
  downloadUrl: z.string().url(),
  primary: z.boolean().optional().optional(),
});

export const imageMetadataSchema = z.object({
  hash: z.string(),
  width: z.number(),
  height: z.number(),
});

export const imageMetaSchema = z.object({
  ENSD: z.string().optional(),
  Size: z.string().optional(),
  seed: z.number().optional(),
  Model: z.string().optional(),
  steps: z.number().optional(),
  hashes: z.record(z.string()).optional(),
  prompt: z.string().optional(),
  sampler: z.string().optional(),
  cfgScale: z.number().optional(),
  ClipSkip: z.number().optional(),
  resources: z.array(
    z.object({
      hash: z.string().optional(),
      name: z.string(),
      type: z.string(),
      weight: z.number().optional(),
    })
  ).optional(),
  ModelHash: z.string().optional(),
  HiresSteps: z.string().optional(),
  HiresUpscale: z.string().optional(),
  HiresUpscaler: z.string().optional(),
  negativePrompt: z.string(),
  DenoisingStrength: z.number().optional(),
});

export const imageSchema = z.object({
  url: z.string().url().optional(),
  nsfw: z.enum(["None", "Soft", "Mature"]).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  hash: z.string().optional(),
  type: z.string().optional(),
  metadata: imageMetadataSchema.optional(),
  meta: imageMetaSchema.optional(),
});

export const modelVersionSchema = z.object({
  id: z.number(),
  modelId: z.number(),
  name: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  status: z.enum(["Published", "Unpublished"]).optional(),
  publishedAt: z.string().optional(),
  trainedWords: z.array(z.string()).nullable(),
  trainingStatus: z.string().nullable(),
  trainingDetails: z.string().nullable(),
  baseModel: z.string().optional(),
  baseModelType: z.string().optional(),
  earlyAccessTimeFrame: z.number().optional(),
  description: z.string().nullable(),
  vaeId: z.string().nullable(),
  stats: z.object({
    downloadCount: z.number(),
    ratingCount: z.number(),
    rating: z.number(),
  }).optional(),
  files: z.array(fileSchema),
  images: z.array(imageSchema),
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
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["Checkpoint", "Lora"]),
  poi: z.boolean().optional(),
  nsfw: z.boolean().optional(),
  allowNoCredit: z.boolean().optional(),
  allowCommercialUse: z.enum(["Rent"]).optional(),
  allowDerivatives: z.boolean().optional(),
  allowDifferentLicense: z.boolean().optional(),
  stats: statsSchema.optional(),
  creator: creatorSchema.optional(),
  tags: z.array(z.string()).optional(),
  modelVersions: z.array(modelVersionSchema),
});
