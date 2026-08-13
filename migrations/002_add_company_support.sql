-- ============================================================================
-- MIGRATION 002: Add Company Support to Z-API Instances
-- ============================================================================
-- This migration creates the companies table and adds company_id to z_api_instances

-- ============================================================================
-- SECTION 1: CREATE COMPANIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic company information
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,

  -- Plan and status tracking
  plan VARCHAR(50) NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),

  -- Ownership
  owner_id UUID NOT NULL,

  -- Brazilian business identifier
  cnpj VARCHAR(18),

  -- Settings and metadata
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',

  -- Audit timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- CREATE INDEXES FOR companies TABLE
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

CREATE INDEX IF NOT EXISTS idx_companies_created_at
  ON companies(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_status_plan
  ON companies(status, plan)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_cnpj
  ON companies(cnpj)
  WHERE cnpj IS NOT NULL;

-- ============================================================================
-- SECTION 2: ADD COMPANY_ID TO Z_API_INSTANCES
-- ============================================================================

ALTER TABLE IF EXISTS z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- CREATE INDEXES FOR Z_API_INSTANCES
CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);

CREATE INDEX IF NOT EXISTS idx_z_api_instances_instance_id_company
  ON z_api_instances(instance_id, company_id);

-- ============================================================================
-- SECTION 3: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- END OF MIGRATION: Add Company Support
-- ============================================================================
