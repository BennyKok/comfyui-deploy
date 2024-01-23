import { registerCreateRunRoute } from "@/routes/registerCreateRunRoute";
import { registerGetOutputRoute } from "@/routes/registerGetOutputRoute";
import { registerUploadRoute } from "@/routes/registerUploadRoute";
import { isKeyRevoked } from "@/server/curdApiKeys";
import { parseJWT } from "@/server/parseJWT";
import type { Context, Next } from "hono";
import { handle } from "hono/vercel";
import { app } from "../../../../routes/app";
import { registerWorkflowUploadRoute } from "@/routes/registerWorkflowUploadRoute";
import { registerGetAuthResponse } from "@/routes/registerGetAuthResponse";
import { registerGetWorkflowRoute } from "@/routes/registerGetWorkflow";
import { cors } from "hono/cors";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

declare module "hono" {
  interface ContextVariableMap {
    apiKeyTokenData: ReturnType<typeof parseJWT>;
  }
}

async function checkAuth(c: Context, next: Next, headers?: HeadersInit) {
  const token = c.req.raw.headers.get("Authorization")?.split(" ")?.[1]; // Assuming token is sent as "Bearer your_token"
  const userData = token ? parseJWT(token) : undefined;
  if (!userData || token === undefined) {
    return c.text("Invalid or expired token", {
      status: 401,
      headers: headers,
    });
  }

  // If the key has expiration, this is a temporary key and not in our db, so we can skip checking
  if (userData.exp === undefined) {
    const revokedKey = await isKeyRevoked(token);
    if (revokedKey)
      return c.text("Revoked token", {
        status: 401,
        headers: headers,
      });
  }

  c.set("apiKeyTokenData", userData);

  await next();
}

app.use("/run", checkAuth);
app.use("/upload-url", checkAuth);

const corsHandler = cors({
  origin: "*",
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["POST", "GET", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
});

// CORS Check
app.use("/workflow", corsHandler, checkAuth);
app.use("/workflow-version/*", corsHandler, checkAuth);

// create run endpoint
registerCreateRunRoute(app);
registerGetOutputRoute(app);

// file upload endpoint
registerUploadRoute(app);

// Anon
registerGetAuthResponse(app);

registerWorkflowUploadRoute(app);
registerGetWorkflowRoute(app);

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
export const OPTIONS = handler;
