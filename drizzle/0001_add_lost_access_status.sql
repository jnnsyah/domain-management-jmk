-- Safe migration: Add lost_access to enum without data loss

-- Step 1: Create enum type if not exists (with all values)
DO $$ BEGIN
  CREATE TYPE website_status AS ENUM ('active', 'sold', 'reject', 'lost_access');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Alter column to use enum, casting existing varchar values
ALTER TABLE websites 
  ALTER COLUMN status TYPE website_status 
  USING status::text::website_status;
