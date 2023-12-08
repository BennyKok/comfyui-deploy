import * as schema from "./schema";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";

// if we're running locally
if (process.env.VERCEL_ENV !== "production") {
  // Set the WebSocket proxy to work with the local instance
  neonConfig.wsProxy = (host) => `${host}:5481/v1`;
  // Disable all authentication and encryption
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

export const db = neonDrizzle(
  new Pool({
    connectionString: process.env.POSTGRES_URL,
  }),
  {
    schema,
  }
);
