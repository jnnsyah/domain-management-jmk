import { pgTable, uuid, varchar, text, boolean, integer, numeric, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export const websites = pgTable('websites', {
  id: uuid('id').defaultRandom().primaryKey(),
  domain: varchar('domain', { length: 255 }).notNull().unique(),
  login_url: text('login_url'),
  ip: varchar('ip', { length: 45 }),
  email: varchar('email', { length: 255 }),
  login_user: text('login_user'),
  login_password: text('login_password'), // Encrypted AES-256-GCM
  gsocket_user: text('gsocket_user'),     // Encrypted AES-256-GCM
  gsocket_root: text('gsocket_root'),     // Encrypted AES-256-GCM
  status: varchar('status', { length: 20 }).default('active').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const endpoints = pgTable('endpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  website_id: uuid('website_id').references(() => websites.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  is_primary: boolean('is_primary').default(false).notNull(),
  status_code: integer('status_code'),
  is_active: boolean('is_active').default(false).notNull(),
  error_detail: text('error_detail'),
  last_checked_at: timestamp('last_checked_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('website_id_url_idx').on(table.website_id, table.url),
]);

export const sales = pgTable('sales', {
  id: uuid('id').defaultRandom().primaryKey(),
  total_price: numeric('total_price', { precision: 15, scale: 2 }).notNull(),
  buyer_note: text('buyer_note'),
  sold_at: timestamp('sold_at', { withTimezone: true }).defaultNow().notNull(),
});

export const saleItems = pgTable('sale_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  sale_id: uuid('sale_id').references(() => sales.id, { onDelete: 'cascade' }).notNull(),
  website_id: uuid('website_id').references(() => websites.id, { onDelete: 'restrict' }).notNull(),
  custom_price: numeric('custom_price', { precision: 15, scale: 2 }),
});

export type Website = InferSelectModel<typeof websites>;
export type NewWebsite = InferInsertModel<typeof websites>;
export type Endpoint = InferSelectModel<typeof endpoints>;
export type NewEndpoint = InferInsertModel<typeof endpoints>;
export type Sale = InferSelectModel<typeof sales>;
export type NewSale = InferInsertModel<typeof sales>;
export type SaleItem = InferSelectModel<typeof saleItems>;
export type NewSaleItem = InferInsertModel<typeof saleItems>;
