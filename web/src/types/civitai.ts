import { z } from 'zod';

export const creatorSchema = z.object({
  username: z.string(),
  image: z.string(),
});

export const statsSchema = z.object({
  downloadCount: z.number(),
  favoriteCount: z.number(),
  commentCount: z.number(),
  ratingCount: z.number(),
  rating: z.number(),
  tippedAmountCount: z.number(),
});

export const modelVersionSchema = z.object({
  id: z.number(),
  modelId: z.number(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.string(),
  publishedAt: z.string(),
  trainedWords: z.array(z.any()), // Replace with more specific type if known
  trainingStatus: z.any().optional(),
  trainingDetails: z.any().optional(),
  baseModel: z.string(),
  baseModelType: z.string(),
  earlyAccessTimeFrame: z.number(),
  description: z.string().optional(),
  vaeId: z.any().optional(), // Replace with more specific type if known
  stats: statsSchema.optional(), // If stats structure is known, replace with specific type
  files: z.array(z.any()), // Replace with more specific type if known
  images: z.array(z.any()), // Replace with more specific type if known
  downloadUrl: z.string(),
});

export const CivitaiModel = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  type: z.string(),
  poi: z.boolean(),
  nsfw: z.boolean(),
  allowNoCredit: z.boolean(),
  allowCommercialUse: z.string(),
  allowDerivatives: z.boolean(),
  allowDifferentLicense: z.boolean(),
  stats: statsSchema,
  creator: creatorSchema,
  tags: z.array(z.string()),
  modelVersions: z.array(modelVersionSchema),
});

