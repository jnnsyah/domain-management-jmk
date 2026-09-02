/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly ENCRYPTION_KEY: string;
  readonly CRON_SECRET: string;
  readonly ADMIN_PASSWORD: string;
  readonly SESSION_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
