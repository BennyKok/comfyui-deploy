import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const isDevContainer = process.env.REMOTE_CONTAINERS !== undefined;

// if we're running locally
if (process.env.VERCEL_ENV !== "production") {
  // Set the WebSocket proxy to work with the local instance
  if (isDevContainer) {
    // Running inside a VS Code devcontainer
    neonConfig.wsProxy = (host) => "host.docker.internal:5481/v1";
  } else {
    // Not running inside a VS Code devcontainer
    neonConfig.wsProxy = (host) => `${host}:5481/v1`;
  }
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
  },
);
