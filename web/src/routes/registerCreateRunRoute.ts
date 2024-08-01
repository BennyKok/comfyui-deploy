import { db } from "@/db/db";
import { deploymentsTable } from "@/db/schema";
import type { App } from "@/routes/app";
import { authError } from "@/routes/authError";
import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { createRun } from "../server/createRun";

const createRunRoute = createRoute({
  method: "post",
  path: "/run",
  tags: ["workflows"],
  summary: "Run a workflow via deployment_id",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            deployment_id: z.string(),
            inputs: z.record(z.union([z.string(), z.number()])).optional(),
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
            run_id: z.string(),
          }),
        },
      },
      description: "Workflow queued",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Error creating run",
    },
    ...authError,
  },
});

export const registerCreateRunRoute = (app: App) => {
  app.openapi(createRunRoute, async (c) => {
    const data = c.req.valid("json");
    const proto = c.req.headers.get('x-forwarded-proto')  || "http";
    const host = c.req.headers.get('x-forwarded-host') || c.req.headers.get('host');
    const origin = `${proto}://${host}` || new URL(c.req.url).origin;
    const apiKeyTokenData = c.get("apiKeyTokenData")!;

    const { deployment_id, inputs } = data;

    try {
      const deploymentData = await db.query.deploymentsTable.findFirst({
        where: eq(deploymentsTable.id, deployment_id),
        with: {
          machine: true,
          version: {
            with: {
              workflow: {
                columns: {
                  org_id: true,
                  user_id: true,
                },
              },
            },
          },
        },
      });

      if (!deploymentData) throw new Error("Deployment not found");

      const run_id = await createRun({
        origin,
        workflow_version_id: deploymentData.version,
        machine_id: deploymentData.machine,
        inputs,
        runOrigin: "api",
        apiUser: apiKeyTokenData,
      });

      if ("error" in run_id) throw new Error(run_id.error);

      return c.json({
        run_id: "workflow_run_id" in run_id ? run_id.workflow_run_id : "",
      });
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
