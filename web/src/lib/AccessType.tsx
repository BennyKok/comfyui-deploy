import { z } from "zod";

export const AccessType = z.object({
  betaFeaturesAccess: z.boolean().default(false),
});
