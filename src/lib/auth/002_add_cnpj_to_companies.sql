-- ============================================================================
-- MIGRATION: Add CNPJ field to Companies table
-- Version: 002
-- Description: Add CNPJ (Brazilian business tax ID) field to companies table
-- Date: 2026-08-13
-- ============================================================================
-- This migration adds CNPJ support for IAeZap's master management endpoints
-- ============================================================================

-- ============================================================================
-- PHASE 1: Add CNPJ column to companies table
-- ============================================================================

-- 1.1 Add CNPJ column if it doesn't exist
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18) UNIQUE NOT NULL DEFAULT '';

-- 1.2 Create index on CNPJ for quick lookups
CREATE INDEX IF NOT EXISTS idx_companies_cnpj
  ON companies(cnpj)
  WHERE deleted_at IS NULL AND cnpj != '';

-- ============================================================================
-- PHASE 2: Create indexes for admin queries
-- ============================================================================

-- Index for owner_id queries (to find all companies owned by a user)
CREATE INDEX IF NOT EXISTS idx_companies_owner_id_active
  ON companies(owner_id)
  WHERE deleted_at IS NULL AND status = 'active';

-- Composite index for status and created_at (common for listing)
CREATE INDEX IF NOT EXISTS idx_companies_status_created_at
  ON companies(status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- PHASE 3: Add CNPJ validation constraint
-- ============================================================================

-- 3.1 Create function to validate CNPJ format
CREATE OR REPLACE FUNCTION validate_cnpj()
RETURNS TRIGGER AS $$
BEGIN
  -- CNPJ format: XX.XXX.XXX/XXXX-XX
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj !~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid CNPJ format. Expected: XX.XXX.XXX/XXXX-XX';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 Create trigger to validate CNPJ on insert and update
DROP TRIGGER IF EXISTS companies_validate_cnpj ON companies;
CREATE TRIGGER companies_validate_cnpj
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION validate_cnpj();

-- ============================================================================
-- PHASE 4: Add comments and documentation
-- ============================================================================

COMMENT ON COLUMN companies.cnpj IS 'Brazilian business tax identification number. Format: XX.XXX.XXX/XXXX-XX';

-- ============================================================================
-- END OF MIGRATION: Add CNPJ to Companies table
-- ============================================================================
