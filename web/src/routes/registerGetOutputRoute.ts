import { workflowRunsTable } from "@/db/schema";
import { createSelectSchema } from "@/lib/drizzle-zod-hono";
import type { App } from "@/routes/app";
import { authError } from "@/routes/authError";
import { getRunsData } from "@/server/getRunsData";
import { z, createRoute } from "@hono/zod-openapi";

const getOutputRoute = createRoute({
  method: "get",
  path: "/run",
  tags: ["workflows"],
  summary: "Get workflow run output",
  description:
    "Call this to get a run's output, usually in conjunction with polling method",
  request: {
    query: z.object({
      run_id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          // https://github.com/asteasolutions/zod-to-openapi/issues/194
          schema: createSelectSchema(workflowRunsTable, {
            workflow_inputs: (schema) =>
              schema.workflow_inputs.openapi({
                type: "object",
                example: {
                  input_text: "some external text input",
                  input_image: "https://somestatic.png",
                },
              }),
          }),
        },
      },
      description: "Retrieve the output",
    },
    400: {
      content: {
        "application/json": {
          schema: z.object({
            code: z.number().openapi({
              type: "string",
              example: 400,
            }),
            message: z.string().openapi({
              type: "string",
              example: "Workflow not found",
            }),
          }),
        },
      },
      description: "Workflow not found",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Error getting output",
    },
    ...authError,
  },
});

export const registerGetOutputRoute = (app: App) => {
  app.openapi(getOutputRoute, async (c) => {
    const data = c.req.valid("query");
    const apiKeyTokenData = c.get("apiKeyTokenData")!;

    try {
      const run = await getRunsData(data.run_id, apiKeyTokenData);

      if (!run)
        return c.json(
          {
            code: 400,
            message: "Workflow not found",
          },
          400
        );

      return c.json(run, 200);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return c.json(
        {
          error: errorMessage,
        },
        {
          status: 500,
        }
      );
    }
  });
};
