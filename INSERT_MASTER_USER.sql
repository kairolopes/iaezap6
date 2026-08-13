-- ============================================================================
-- IAeZap Master User Creation Script
-- ============================================================================
-- This script creates the master user after the database schema has been
-- initialized via migrations/001_complete_migration_bundle.sql
--
-- PREREQUISITES:
-- 1. Database migrations must be executed first
-- 2. The 'companies' table must exist
-- 3. The 'users' table must exist with 'user_role' enum
--
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard: https://app.supabase.com
-- 2. Project: gqromcfhiosfppqlottz
-- 3. SQL Editor → New Query
-- 4. Copy this entire file and paste into the SQL editor
-- 5. Click RUN
-- 6. Save the generated company_id and user_id
-- ============================================================================

-- Step 1: Create Master Company (if it doesn't exist)
INSERT INTO companies (
  name,
  slug,
  description,
  plan,
  status,
  owner_id,
  metadata,
  settings
)
SELECT
  'Master Company' as name,
  'master' as slug,
  'Master Company for IAeZap Platform' as description,
  'enterprise' as plan,
  'active' as status,
  gen_random_uuid() as owner_id,
  '{}' as metadata,
  '{}' as settings
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE slug = 'master'
)
RETURNING
  id as master_company_id,
  name,
  slug,
  plan,
  status;

-- Step 2: Get the master company ID
-- NOTE: Copy the company_id from the result above

-- Step 3: Create Master User
-- NOTE: Replace [MASTER_COMPANY_ID] with the company_id from Step 2
-- NOTE: Replace [PASSWORD_HASH] with bcrypt hash from setup script

INSERT INTO users (
  company_id,
  email,
  full_name,
  role,
  password_hash,
  status,
  email_verified,
  email_verified_at,
  created_at
)
VALUES (
  '[MASTER_COMPANY_ID]'::uuid,  -- Replace with actual company ID
  'kairolopesoficial@gmail.com',
  'Master Admin',
  'owner'::user_role,
  '[PASSWORD_HASH]',  -- Replace with bcrypt hash from: node migrate-and-create-user.mjs
  'active',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
RETURNING
  id as user_id,
  email,
  role,
  company_id,
  status,
  email_verified,
  created_at;

-- Step 4: Verify Master User Creation
SELECT
  'MASTER USER CREATED' as status,
  u.id as user_id,
  u.email,
  u.role,
  c.id as company_id,
  c.name as company_name,
  c.slug,
  c.plan,
  u.status,
  u.email_verified
FROM users u
INNER JOIN companies c ON u.company_id = c.id
WHERE u.email = 'kairolopesoficial@gmail.com'
AND u.deleted_at IS NULL;

-- ============================================================================
-- REQUIRED VALUES TO CAPTURE:
-- ============================================================================
-- From Step 1: MASTER_COMPANY_ID = [Copy the company ID from the result]
-- From Step 2: PASSWORD_HASH = [Generate using: node migrate-and-create-user.mjs]
-- From Step 3: USER_ID = [Will be returned in the insert result]
-- From Step 4: Verify the master user was created successfully
--
-- FINAL VERIFICATION QUERY:
-- SELECT * FROM users WHERE email = 'kairolopesoficial@gmail.com';
-- ============================================================================
