import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

config({
  path: `.env.local`,
});

export default {
  schema: './src/db/schema.ts',
  driver: 'pg',
  out: './drizzle',
  dbCredentials: {
    connectionString: (process.env.POSTGRES_URL as string) + ( process.env.POSTGRES_SSL !== "false" ? '?ssl=true' : ""),
  },
} satisfies Config;
