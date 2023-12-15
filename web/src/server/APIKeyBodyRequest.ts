import { z } from "zod";

export const APIKeyBodyRequest = z.object({
  user_id: z.string().optional(),
  org_id: z.string().optional(),
  iat: z.number(),
});
