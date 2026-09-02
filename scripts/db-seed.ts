import dotenv from 'dotenv';
import { db } from '../src/db/index';
import { websites, endpoints } from '../src/db/schema';
import { encrypt } from '../src/lib/crypto';
import { resolveDomainIp } from '../src/lib/dns';

dotenv.config();

async function seed() {
  console.log('Seeding initial test domain to Neon DB...');
  
  const testDomain = 'crochetwithlove.org';
  const ip = await resolveDomainIp(testDomain);

  const [insertedWeb] = await db.insert(websites).values({
    domain: testDomain,
    login_url: `https://${testDomain}/wp-login.php`,
    ip: ip,
    email: 'admin@crochetwithlove.org',
    login_user: 'admin',
    login_password: encrypt('SuperSecretPass123!'),
    gsocket_user: encrypt('gs_user_val'),
    gsocket_root: encrypt('gs_root_val'),
    status: 'active',
  }).onConflictDoNothing({ target: websites.domain }).returning();

  if (insertedWeb) {
    console.log('Inserted website:', insertedWeb.id, insertedWeb.domain);
    await db.insert(endpoints).values([
      {
        website_id: insertedWeb.id,
        url: `https://${testDomain}/wp-admin/license.php`,
        is_primary: true,
        is_active: true,
        status_code: 200,
      },
      {
        website_id: insertedWeb.id,
        url: `https://${testDomain}/shell.php`,
        is_primary: false,
        is_active: false,
        status_code: 404,
      }
    ]).onConflictDoNothing();
    console.log('Inserted endpoints successfully');
  } else {
    console.log('Test domain already exists in DB');
  }

  console.log('Seed completed cleanly!');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
