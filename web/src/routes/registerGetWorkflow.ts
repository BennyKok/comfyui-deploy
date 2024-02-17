import { workflowVersionSchema, workflowVersionTable } from "@/db/schema";
import type { App } from "@/routes/app";
import { authError } from "@/routes/authError";
import { getWorkflowVersion } from "@/server/crudWorkflow";
import { z, createRoute } from "@hono/zod-openapi";
import { createSelectSchema } from "drizzle-zod";

const route = createRoute({
  method: "get",
  path: "/workflow-version/:version_id",
  tags: ["comfyui"],
  summary: "Get comfyui workflow",
  description: "Use this to retrieve comfyui workflow by id",
  request: {
    params: z.object({
      version_id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSelectSchema(workflowVersionTable, {
            workflow_api: (schema) =>
              schema.workflow_api.openapi({
                type: "object",
              }),
            workflow: (schema) =>
              schema.workflow.openapi({
                type: "object",
              }),
            snapshot: (schema) =>
              schema.snapshot.openapi({
                type: "object",
              }),
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
      description: "Error when uploading the workflow",
    },
    ...authError,
  },
});

export const registerGetWorkflowRoute = (app: App) => {
  return app.openapi(route, async (c) => {
    const { version_id } = c.req.valid("param");
    const apiUser = c.get("apiKeyTokenData")!;

    if (!apiUser.user_id)
      return c.json(
        {
          error: "Invalid user_id",
        },
        {
          status: 500,
        },
      );

    try {
      const workflow_version = await getWorkflowVersion(apiUser, version_id);
      if (workflow_version) {
        return c.json(workflow_version, {
          status: 200,
        });
      } else {
        return c.json(
          {
            error: "No version found",
          },
          {
            status: 500,
          },
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return c.json(
        {
          error: errorMessage,
        },
        {
          statusText: "Invalid request",
          status: 500,
        },
      );
    }
  });
};
