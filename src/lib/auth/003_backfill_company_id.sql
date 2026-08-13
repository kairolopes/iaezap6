-- ============================================================================
-- MIGRATION: Backfill company_id in z_api_instances table
-- Version: 003
-- Description: Create default company and backfill company_id for all API instances
-- Date: 2026-08-13
-- ============================================================================
-- This migration:
-- 1. Creates a default company with CNPJ "00.000.000/0000-00" (or gets existing)
-- 2. Backfills company_id in z_api_instances for all instances without a company
-- 3. Includes comprehensive verification queries
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE DEFAULT COMPANY
-- ============================================================================
-- Create a default company that will be used for all unassigned API instances
-- Uses INSERT ... ON CONFLICT to handle idempotency (safe to run multiple times)

-- 1.1 INSERT DEFAULT COMPANY (with conflict handling)
-- This will create the company if it doesn't exist, or skip if it does
INSERT INTO companies (
  id,
  name,
  slug,
  description,
  plan,
  status,
  owner_id,
  cnpj,
  metadata,
  settings,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Default Company',
  'default-company',
  'Default company for unassigned API instances during migration',
  'starter',
  'active',
  '00000000-0000-0000-0000-000000000000'::UUID,
  '00.000.000/0000-00',
  jsonb_build_object(
    'backfill_default', true,
    'created_by_migration', '003_backfill_company_id',
    'created_at_migration', NOW()
  ),
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (slug) DO NOTHING;

-- 1.2 ALTERNATIVE: If using different CNPJ uniqueness approach
-- If CNPJ is truly unique and you want to handle conflicts on CNPJ instead:
-- ON CONFLICT (cnpj) DO NOTHING;

-- ============================================================================
-- SECTION 2: VERIFY DEFAULT COMPANY WAS CREATED
-- ============================================================================

-- 2.1 Query to get the default company ID
-- Store this for use in the UPDATE statement
WITH default_company AS (
  SELECT id FROM companies
  WHERE slug = 'default-company'
  LIMIT 1
)
-- Verification: Show the default company
SELECT
  'Default Company Created/Found' as status,
  (SELECT id FROM default_company) as company_id,
  (SELECT name FROM companies WHERE slug = 'default-company') as company_name,
  (SELECT cnpj FROM companies WHERE slug = 'default-company') as cnpj;

-- ============================================================================
-- SECTION 3: BACKFILL COMPANY_ID IN z_api_instances
-- ============================================================================
-- Update all instances that don't have a company_id assigned yet

-- 3.1 UPDATE z_api_instances with default company_id
UPDATE z_api_instances
SET
  company_id = (
    SELECT id FROM companies
    WHERE slug = 'default-company'
    LIMIT 1
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE
  company_id IS NULL
  AND id IS NOT NULL;  -- Safety check: only update existing records

-- ============================================================================
-- SECTION 4: VERIFICATION QUERIES
-- ============================================================================

-- 4.1 Verify companies table state
SELECT
  'companies_table' as entity,
  COUNT(*) as total_count,
  COUNT(CASE WHEN slug = 'default-company' THEN 1 END) as default_companies,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_companies
FROM companies;

-- 4.2 Verify z_api_instances backfill status
SELECT
  'z_api_instances' as entity,
  COUNT(*) as total_instances,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company_id,
  ROUND(
    COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as percentage_backfilled
FROM z_api_instances;

-- 4.3 Show distribution of instances across companies
SELECT
  c.slug as company_slug,
  c.name as company_name,
  COUNT(zai.id) as instance_count,
  COUNT(CASE WHEN zai.tenant_id IS NOT NULL THEN 1 END) as instances_with_tenant
FROM companies c
LEFT JOIN z_api_instances zai ON zai.company_id = c.id
GROUP BY c.id, c.slug, c.name
ORDER BY instance_count DESC;

-- 4.4 Verify default company details
SELECT
  id as company_id,
  name,
  slug,
  cnpj,
  plan,
  status,
  owner_id,
  metadata->>'backfill_default' as is_backfill_default,
  metadata->>'created_by_migration' as created_by_migration,
  created_at,
  updated_at
FROM companies
WHERE slug = 'default-company';

-- 4.5 Show sample of backfilled instances
SELECT
  zai.id,
  zai.instance_id,
  zai.tenant_id,
  zai.company_id,
  c.slug as company_slug,
  c.name as company_name,
  zai.created_at,
  zai.updated_at
FROM z_api_instances zai
LEFT JOIN companies c ON zai.company_id = c.id
ORDER BY zai.updated_at DESC
LIMIT 10;

-- 4.6 Data integrity check: ensure no instances were lost
SELECT
  'Data Integrity Check' as check_name,
  COUNT(*) as total_instances,
  COUNT(CASE WHEN instance_id IS NOT NULL THEN 1 END) as valid_instance_ids,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as linked_to_company
FROM z_api_instances;

-- ============================================================================
-- SECTION 5: OPTIONAL - SAFETY ROLLBACK PROCEDURE
-- ============================================================================
-- If you need to rollback this migration, uncomment and execute these commands
-- in the order they are listed (in reverse of the migration steps)

/*
-- 5.1 Reset company_id in z_api_instances to NULL
-- WARNING: This will remove all company associations
UPDATE z_api_instances
SET company_id = NULL, updated_at = CURRENT_TIMESTAMP
WHERE company_id = (SELECT id FROM companies WHERE slug = 'default-company');

-- 5.2 Delete the default company
DELETE FROM companies
WHERE slug = 'default-company';

-- 5.3 Verify rollback
SELECT COUNT(*) as remaining_instances_with_company FROM z_api_instances WHERE company_id IS NOT NULL;
SELECT COUNT(*) as default_companies FROM companies WHERE slug = 'default-company';
*/

-- ============================================================================
-- SECTION 6: NEXT STEPS
-- ============================================================================
-- After this migration runs successfully:
-- 1. ✅ Verify the verification queries above show expected results
-- 2. ✅ Check that all z_api_instances have company_id filled
-- 3. ✅ If needed, run step 6.1 below to make company_id NOT NULL
-- 4. ✅ Update application code to require company_id in z_api_instances

-- 6.1 OPTIONAL: Make company_id NOT NULL (only after full backfill verification)
-- Uncomment only after:
-- - Verifying all instances have company_id
-- - Updating any code that expects company_id to be nullable
/*
ALTER TABLE z_api_instances
ALTER COLUMN company_id SET NOT NULL;

-- Verify the constraint was added
SELECT
  table_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'z_api_instances'
AND column_name = 'company_id';
*/

-- 6.2 OPTIONAL: Add unique constraint (if instances should be unique per company)
-- Uncomment only if this constraint makes sense for your use case
/*
ALTER TABLE z_api_instances
ADD CONSTRAINT z_api_instances_company_instance_unique
UNIQUE (company_id, instance_id);
*/

-- ============================================================================
-- END OF MIGRATION: Backfill company_id in z_api_instances
-- ============================================================================
