import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function checkDomainAge() {
  console.log('Checking domain age data in database...\n');
  
  try {
    const result = await sql`
      SELECT domain, domain_age_days, created_date, expiry_date, last_age_check
      FROM websites
      WHERE domain_age_days IS NOT NULL
      LIMIT 5
    `;
    
    if (result.length === 0) {
      console.log('❌ No domain age data found in database.');
      console.log('Fetch domain age by clicking "Refresh Age" button in UI.\n');
    } else {
      console.log(`✅ Found ${result.length} domain(s) with age data:\n`);
      result.forEach((row) => {
        console.log(`Domain: ${row.domain}`);
        console.log(`  Age: ${row.domain_age_days} days`);
        console.log(`  Created: ${row.created_date}`);
        console.log(`  Expires: ${row.expiry_date}`);
        console.log(`  Last Check: ${row.last_age_check}\n`);
      });
    }
  } catch (error) {
    console.error('❌ Query failed:', error);
  }
}

checkDomainAge();
