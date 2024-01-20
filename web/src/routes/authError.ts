import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";


import { z } from "@hono/zod-openapi";

export const authError = {
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
