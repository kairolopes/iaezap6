-- ============================================================================
-- MIGRATION 003: Backfill Company ID for Z-API Instances
-- ============================================================================
-- This migration creates a default company and backfills company_id
-- for all z_api_instances records where company_id is NULL

-- ============================================================================
-- SECTION 1: CREATE DEFAULT COMPANY
-- ============================================================================

-- Check if default company already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = '00000000-0000-0000-0000-000000000001') THEN
    INSERT INTO companies (
      id,
      name,
      slug,
      plan,
      status,
      owner_id,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000001'::uuid,
      'Default Company',
      'default-company',
      'starter',
      'active',
      '00000000-0000-0000-0000-000000000000'::uuid,
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Default company created with ID: 00000000-0000-0000-0000-000000000001';
  ELSE
    RAISE NOTICE 'Default company already exists';
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: BACKFILL COMPANY_ID
-- ============================================================================

-- Update all z_api_instances records with NULL company_id
-- to use the default company
UPDATE z_api_instances
SET company_id = '00000000-0000-0000-0000-000000000001'::uuid,
    updated_at = NOW()
WHERE company_id IS NULL;

-- ============================================================================
-- SECTION 3: VERIFICATION QUERIES
-- ============================================================================

-- Verify backfill was successful
SELECT
  COUNT(*) as total_instances,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company,
  ROUND(100.0 * COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) /
    CASE WHEN COUNT(*) = 0 THEN 1 ELSE COUNT(*) END, 2) as percentage_with_company
FROM z_api_instances;

-- Show breakdown by company
SELECT
  company_id,
  COUNT(*) as instance_count
FROM z_api_instances
GROUP BY company_id
ORDER BY instance_count DESC;

-- ============================================================================
-- END OF MIGRATION: Backfill Company ID
-- ============================================================================
