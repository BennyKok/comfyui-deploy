import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({
  path: `.env.local`,
});

export default {
  schema: "./src/db/schema.ts",
  driver: "pg",
  out: "./drizzle",
  dbCredentials: {
    connectionString:
      (process.env.POSTGRES_URL as string) +
      (process.env.POSTGRES_SSL !== "false" ? "?ssl=true" : ""),
  },
} satisfies Config;
