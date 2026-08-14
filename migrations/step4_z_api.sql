ALTER TABLE z_api_instances ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

UPDATE z_api_instances SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_z_api_company_id ON z_api_instances(company_id);
