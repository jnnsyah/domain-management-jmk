import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    console.log('Running migration: Add lost_access status...');
    
    // Step 1: Create enum type (will fail if exists, that's OK)
    console.log('Step 1: Creating enum type...');
    try {
      await sql`CREATE TYPE website_status AS ENUM ('active', 'sold', 'reject', 'lost_access')`;
      console.log('✅ Enum created');
    } catch (err) {
      if (err.code === '42710') {
        console.log('ℹ️ Enum already exists');
        // Try to add lost_access value if enum exists
        try {
          await sql`ALTER TYPE website_status ADD VALUE IF NOT EXISTS 'lost_access'`;
          console.log('✅ Added lost_access to existing enum');
        } catch (addErr) {
          console.log('ℹ️ lost_access value may already exist');
        }
      } else {
        throw err;
      }
    }
    
    // Step 2: Alter column to use enum
    console.log('Step 2: Converting column to enum type...');
    await sql`ALTER TABLE websites ALTER COLUMN status DROP DEFAULT`;
    console.log('  - Dropped default');
    await sql`ALTER TABLE websites ALTER COLUMN status TYPE website_status USING status::text::website_status`;
    console.log('  - Column converted');
    await sql`ALTER TABLE websites ALTER COLUMN status SET DEFAULT 'active'::website_status`;
    console.log('  - Default restored');
    console.log('✅ Column converted');
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
