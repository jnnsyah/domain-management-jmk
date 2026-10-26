import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Adding domain age columns to websites table...');
  
  try {
    // Add columns for domain age tracking
    await sql`
      ALTER TABLE websites
      ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS domain_age_days INTEGER,
      ADD COLUMN IF NOT EXISTS last_age_check TIMESTAMPTZ
    `;
    
    console.log('✅ Domain age columns added successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
