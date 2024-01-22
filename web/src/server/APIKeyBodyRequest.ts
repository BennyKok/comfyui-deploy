import { z } from "zod";

export const APIKeyBodyRequest = z.object({
  user_id: z.string().optional().nullable(),
  org_id: z.string().optional().nullable(),
  iat: z.number(),
  exp: z.number().optional(),
});

export type APIKeyUserType = z.infer<typeof APIKeyBodyRequest>;
