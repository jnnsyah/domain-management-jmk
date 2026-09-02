import dotenv from 'dotenv';
import { db } from '../src/db';
import { websites, endpoints, sales, saleItems } from '../src/db/schema';
import { dbRetry } from '../src/lib/db-utils';

dotenv.config();

async function resetDatabase() {
  console.log('====================================================');
  console.log('RESETTING NEON DATABASE TO FRESH BLANK STATE');
  console.log('====================================================\n');

  await dbRetry(async () => {
    console.log('[1/4] Deleting sale items...');
    await db.delete(saleItems);

    console.log('[2/4] Deleting sales transactions...');
    await db.delete(sales);

    console.log('[3/4] Deleting endpoints...');
    await db.delete(endpoints);

    console.log('[4/4] Deleting websites...');
    await db.delete(websites);
  });

  console.log('\n====================================================');
  console.log('✨ DATABASE HAS BEEN 100% RESET & CLEARED CLEANLY! ✨');
  console.log('====================================================');
}

resetDatabase().catch((err) => {
  console.error('\n❌ Database reset failed:', err);
  process.exit(1);
});
