-- ============================================================================
-- SETUP: Create Master Company
-- ============================================================================
-- This SQL script creates the master company in Supabase
-- Execute this in the Supabase SQL Editor (Dashboard -> SQL Editor)

-- Step 1: Create the companies table if it doesn't exist
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  plan VARCHAR(50) NOT NULL DEFAULT 'enterprise'
    CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),
  owner_id UUID,
  cnpj VARCHAR(18),
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_slug
  ON companies(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_owner_id
  ON companies(owner_id);

CREATE INDEX IF NOT EXISTS idx_companies_status
  ON companies(status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_plan
  ON companies(plan);

CREATE INDEX IF NOT EXISTS idx_companies_cnpj
  ON companies(cnpj)
  WHERE cnpj IS NOT NULL;

-- Step 3: Add company_id column to z_api_instances if it doesn't exist
ALTER TABLE IF EXISTS z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);

-- Step 4: Insert the master company if it doesn't already exist
INSERT INTO companies (name, slug, cnpj, plan, status, owner_id, metadata)
SELECT
  'Master Company' AS name,
  'master' AS slug,
  '00.000.000/0000-00' AS cnpj,
  'enterprise' AS plan,
  'active' AS status,
  NULL AS owner_id,
  '{"type":"master","system_managed":true}'::JSONB AS metadata
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE slug IN ('master', 'default-company')
)
RETURNING id, name, slug;
