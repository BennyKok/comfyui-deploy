import { createRun } from "../../../../server/createRun";
import { db } from "@/db/db";
import { deploymentsTable, workflowRunsTable } from "@/db/schema";
import { createSelectSchema } from "@/lib/drizzle-zod-hono";
import { isKeyRevoked } from "@/server/curdApiKeys";
import { getRunsData } from "@/server/getRunsOutput";
import { parseJWT } from "@/server/parseJWT";
import { replaceCDNUrl } from "@/server/replaceCDNUrl";
import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import { z, createRoute } from "@hono/zod-openapi";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { handle } from "hono/vercel";

export const dynamic = "force-dynamic";

const app = new OpenAPIHono().basePath("/api");

declare module "hono" {
  interface ContextVariableMap {
    apiKeyTokenData: ReturnType<typeof parseJWT>;
  }
}

const authError = {
  401: {
    content: {
      "text/plain": {
        schema: z.string().openapi({
          type: "string",
          example: "Invalid or expired token",
        }),
      },
    },
    description: "Invalid or expired token",
  },
} satisfies {
  [statusCode: string]: ResponseConfig;
};

app.use("/run", async (c, next) => {
  const token = c.req.raw.headers.get("Authorization")?.split(" ")?.[1]; // Assuming token is sent as "Bearer your_token"
  const userData = token ? parseJWT(token) : undefined;
  if (!userData || token === undefined) {
    return c.text("Invalid or expired token", 401);
  } else {
    const revokedKey = await isKeyRevoked(token);
    if (revokedKey) return c.text("Revoked token", 401);
  }

  c.set("apiKeyTokenData", userData);

  await next();
});

// console.log(RunOutputZod.shape);

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

app.openapi(getOutputRoute, async (c) => {
  const data = c.req.valid("query");
  const apiKeyTokenData = c.get("apiKeyTokenData")!;

  try {
    const run = await getRunsData(apiKeyTokenData, data.run_id);

    if (!run)
      return c.json(
        {
          code: 400,
          message: "Workflow not found",
        },
        400
      );

    // Fill in the CDN url
    if (run?.status === "success" && run?.outputs?.length > 0) {
      for (let i = 0; i < run.outputs.length; i++) {
        const output = run.outputs[i];

        if (output.data?.images !== undefined) {
          for (let j = 0; j < output.data?.images.length; j++) {
            const element = output.data?.images[j];
            element.url = replaceCDNUrl(
              `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}/outputs/runs/${run.id}/${element.filename}`
            );
          }
        } else if (output.data?.files !== undefined) {
          for (let j = 0; j < output.data?.files.length; j++) {
            const element = output.data?.files[j];
            element.url = replaceCDNUrl(
              `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}/outputs/runs/${run.id}/${element.filename}`
            );
          }
        }
      }
    }

    return c.json(run, 200);
  } catch (error: any) {
    return c.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
});

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
            inputs: z.record(z.string()).optional(),
          }),
        },
      },
    },
    // headers: z.object({
    //   "Authorization": z.
    // })
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

app.openapi(createRunRoute, async (c) => {
  const data = c.req.valid("json");
  const origin = new URL(c.req.url).origin;
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
      isManualRun: false,
      apiUser: apiKeyTokenData,
    });

    if ("error" in run_id) throw new Error(run_id.error);

    return c.json({
      run_id: "workflow_run_id" in run_id ? run_id.workflow_run_id : "",
    });
  } catch (error: any) {
    return c.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
});

// The OpenAPI documentation will be available at /doc
app.doc("/doc", {
  openapi: "3.0.0",
  servers: [{ url: "/api" }],
  security: [{ bearerAuth: [] }],
  info: {
    version: "0.0.1",
    title: "Comfy Deploy API",
    description:
      "Interact with Comfy Deploy programmatically to trigger run and retrieve output",
  },
});

app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "apiKey",
  bearerFormat: "JWT",
  in: "header",
  name: "Authorization",
  description:
    "API token created in Comfy Deploy <a href='/api-keys' target='_blank' style='text-decoration: underline;'>/api-keys</a>",
});

const handler = handle(app);

export const GET = handler;
export const POST = handler;
