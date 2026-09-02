import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import * as dotenv from 'dotenv';

// Ensure environment variables are loaded in non-standard execution contexts
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

const sql = neon(dbUrl);
export const db = drizzle({ client: sql, schema });
