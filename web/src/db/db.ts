import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Initialize database connection with single connection string
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // Optional: Enable SSL if needed (usually for production databases)
  // ssl: { rejectUnauthorized: false }
});

// Export the database instance
export const db = drizzle(pool, { schema });

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});
