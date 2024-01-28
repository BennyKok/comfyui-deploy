"use client";
import { z } from "zod";

export const Model = z.object({
  name: z.string(),
  type: z.string(),
  base: z.string(),
  save_path: z.string(),
  description: z.string(),
  reference: z.string(),
  filename: z.string(),
  url: z.string(),
});

export const CivitalModelSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      description: z.string(),
      type: z.string(),
      creator: z
        .object({
          username: z.string().nullable(),
          image: z.string().nullable().default(null),
        })
        .nullable(),
      tags: z.array(z.string()),
      modelVersions: z.array(
        z.object({
          id: z.number(),
          modelId: z.number(),
          name: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          status: z.string(),
          publishedAt: z.string(),
          trainedWords: z.array(z.unknown()),
          trainingStatus: z.string().nullable(),
          trainingDetails: z.string().nullable(),
          baseModel: z.string(),
          baseModelType: z.string().nullable(),
          earlyAccessTimeFrame: z.number(),
          description: z.string().nullable(),
          vaeId: z.number().nullable(),
          stats: z.object({
            downloadCount: z.number(),
            ratingCount: z.number(),
            rating: z.number(),
          }),
          files: z.array(
            z.object({
              id: z.number(),
              sizeKB: z.number(),
              name: z.string(),
              type: z.string(),
              downloadUrl: z.string(),
            }),
          ),
          images: z.array(
            z.object({
              id: z.number(),
              url: z.string(),
              nsfw: z.string(),
              width: z.number(),
              height: z.number(),
              hash: z.string(),
              type: z.string(),
              metadata: z.object({
                hash: z.string(),
                width: z.number(),
                height: z.number(),
              }),
              meta: z.any(),
            }),
          ),
          downloadUrl: z.string(),
        }),
      ),
    }),
  ),
  metadata: z.object({
    totalItems: z.number(),
    currentPage: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
    nextPage: z.string().optional(),
  }),
});
export const ModelList = z.array(Model);

export const ModelListWrapper = z.object({
  models: ModelList,
});
