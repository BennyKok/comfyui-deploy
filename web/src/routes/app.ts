import { OpenAPIHono } from "@hono/zod-openapi";

export const app = new OpenAPIHono().basePath("/api");
export type App = typeof app;
