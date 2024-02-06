import { db } from "@/db/db";
import {
  snapshotType,
  workflowAPIType,
  workflowTable,
  workflowType,
} from "@/db/schema";
import type { App } from "@/routes/app";
import { authError } from "@/routes/authError";
import {
  createNewWorkflow,
  createNewWorkflowVersion,
} from "@/server/createNewWorkflow";
import { z, createRoute } from "@hono/zod-openapi";
import { and, eq, isNull } from "drizzle-orm";

const route = createRoute({
  method: "post",
  path: "/workflow",
  tags: ["comfyui"],
  summary: "Upload workflow from ComfyUI",
  description:
    "This endpoints is specifically built for ComfyUI workflow upload.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            workflow_id: z.string().optional(),
            workflow_name: z.string().min(1).optional(),
            workflow: workflowType,
            workflow_api: workflowAPIType,
            snapshot: snapshotType,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            workflow_id: z.string(),
            version: z.string(),
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const registerWorkflowUploadRoute = (app: App) => {
  app.openapi(route, async (c) => {
    const {
      // user_id,
      workflow,
      workflow_api,
      workflow_id: _workflow_id,
      workflow_name,
      snapshot,
    } = c.req.valid("json");
    const { org_id, user_id } = c.get("apiKeyTokenData")!;

    if (!user_id)
      return c.json(
        {
          error: "Invalid user_id",
        },
        {
          headers: corsHeaders,
          status: 500,
        },
      );

    let workflow_id = _workflow_id;

    let version = -1;

    try {
      if ((!workflow_id || workflow_id.length === 0) && workflow_name) {
        // Create a new parent workflow
        const { workflow_id: _workflow_id, version: _version } =
          await createNewWorkflow({
            user_id: user_id,
            org_id: org_id,
            workflow_name: workflow_name,
            workflowData: {
              workflow,
              workflow_api,
              snapshot,
            },
          });

        workflow_id = _workflow_id;
        version = _version;
      } else if (workflow_id) {
        const _workflow = await db
          .select()
          .from(workflowTable)
          .where(
            and(
              eq(workflowTable.id, workflow_id),
              eq(workflowTable.user_id, user_id),
              org_id
                ? eq(workflowTable.org_id, org_id)
                : isNull(workflowTable.org_id),
            ),
          );

        if (_workflow.length === 0) {
          return c.json(
            {
              error: "Invalid workflow_id",
            },
            {
              status: 500,
              statusText: "Invalid workflow_id",
              headers: corsHeaders,
            },
          );
        }

        // Case 2 update workflow
        const { version: _version } = await createNewWorkflowVersion({
          workflow_id: workflow_id,
          workflowData: {
            workflow,
            workflow_api,
            snapshot,
          },
        });
        version = _version;
      } else {
        return c.json(
          {
            error: "Invalid request, missing either workflow_id or name",
          },
          {
            status: 500,
            statusText: "Invalid request",
            headers: corsHeaders,
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
          headers: corsHeaders,
        },
      );
    }

    return c.json(
      {
        workflow_id: workflow_id,
        version: version,
      },
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  });

  app.route("/upload-workflow").options(async (c) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  });
};
