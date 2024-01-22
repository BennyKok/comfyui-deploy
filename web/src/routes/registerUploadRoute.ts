import type { App } from "@/routes/app";
import { authError } from "@/routes/authError";
import { getFileDownloadUrl } from "@/server/getFileDownloadUrl";
import { handleResourceUpload } from "@/server/resource";
import { z, createRoute } from "@hono/zod-openapi";
import { newId } from "./newId";

const uploadUrlRoute = createRoute({
  method: "get",
  path: "/upload-url",
  tags: ["files"],
  summary: "Upload any files to the storage",
  description:
    "Usually when you run something, you want to upload a file, image etc.",
  request: {
    query: z.object({
      type: z.enum(["image/png", "image/jpg", "image/jpeg"]),
      file_size: z
        .string()
        .refine((value) => !isNaN(Number(value)), {
          message: "file_size must be a number",
          path: ["file_size"],
        })
        .refine((value) => Number(value) > 0, {
          message: "file_size cannot be less than or equal to 0",
          path: ["file_size"],
        })
        .transform((v) => parseFloat(v)),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            upload_url: z.string(),
            file_id: z.string(),
            download_url: z.string(),
          }),
        },
      },
      description: "Retrieve the output",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Error when generating upload url",
    },
    ...authError,
  },
});

export const registerUploadRoute = (app: App) => {
  app.openapi(uploadUrlRoute, async (c) => {
    const data = c.req.valid("query");

    const sizeLimit = 50;

    try {
      if (data.file_size > sizeLimit * 1024 * 1024) {
        // Check if the file size is greater than 50MB
        throw new Error(`File size exceeds ${sizeLimit}MB limit`);
      }

      const id = newId("img");
      const filePath = `inputs/${id}.${data.type.split("/")[1]}`;

      const uploadUrl = await handleResourceUpload({
        resourceBucket: process.env.SPACES_BUCKET,
        resourceId: filePath,
        resourceType: data.type,
        isPublic: true,
      });

      return c.json(
        {
          upload_url: uploadUrl,
          file_id: id,
          download_url: await getFileDownloadUrl(filePath),
        },
        200,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return c.json(
        {
          error: errorMessage,
        },
        {
          status: 500,
        },
      );
    }
  });
};
