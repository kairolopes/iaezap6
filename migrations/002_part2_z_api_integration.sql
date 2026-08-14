-- ============================================================================
-- IAeZap Multi-Tenant System - Part 2: Z-API INTEGRATION
-- ============================================================================

-- MODIFY Z_API_INSTANCES TABLE
ALTER TABLE IF EXISTS z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- CREATE INDEXES FOR Z_API_INSTANCES
CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);

CREATE INDEX IF NOT EXISTS idx_z_api_instances_instance_id_company
  ON z_api_instances(instance_id, company_id);

-- DISABLE RLS ON Z-API TABLES (service_role needs access for webhooks)
ALTER TABLE IF EXISTS conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS message_rules DISABLE ROW LEVEL SECURITY;

-- BACKFILL COMPANY_ID FOR EXISTING Z-API INSTANCES
UPDATE z_api_instances
SET company_id = '00000000-0000-0000-0000-000000000001'::UUID
WHERE company_id IS NULL;

-- ADD COMMENT
COMMENT ON COLUMN z_api_instances.company_id IS 'Foreign key to companies - associates Z-API instances with companies';
