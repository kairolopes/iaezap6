# Z-API Instances Backfill - Complete Setup Guide

## Overview

This guide walks through setting up the multi-tenant company structure and backfilling the `company_id` column in `z_api_instances` table.

**Expected Final Result:**
- Total z_api_instances: 2
- With company_id: 2  
- Backfill percentage: 100%

## Current Status

- ✓ z_api_instances table exists
- ✗ companies table missing
- ✗ company_id column missing from z_api_instances
- ✗ Backfill not executed

## Step 1: Create Schema in Supabase SQL Editor

1. Open Supabase SQL Editor:
   https://supabase.com/dashboard/project/gqromcfhiosfppqlottz/sql

2. Create a new query and paste ALL of the following SQL:

```sql
-- ============================================================================
-- Create companies table
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  plan VARCHAR(50) NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),
  owner_id UUID NOT NULL,
  cnpj VARCHAR(18),
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- Create indexes for companies
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_companies_slug 
  ON companies(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_status 
  ON companies(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_plan ON companies(plan);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_status_plan 
  ON companies(status, plan) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_cnpj 
  ON companies(cnpj) WHERE cnpj IS NOT NULL;

-- ============================================================================
-- Add company_id column to z_api_instances
-- ============================================================================
ALTER TABLE z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================================================
-- Create indexes for z_api_instances company_id
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id ON z_api_instances(company_id);
CREATE INDEX IF NOT EXISTS idx_z_api_instances_instance_id_company 
  ON z_api_instances(instance_id, company_id);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
```

3. Click **Run** button and wait for success
4. You should see: "Query executed successfully" or similar message

## Step 2: Create Default Company

In the same Supabase SQL Editor, create a new query and execute:

```sql
-- Create the default company
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

-- Verify it was created
SELECT id, name, slug, cnpj, status 
FROM companies 
WHERE slug = 'default-company';
```

Expected output (1 row):
| id | name | slug | cnpj | status |
|----|------|------|------|--------|
| 00000000-0000-0000-0000-000000000001 | Default Company | default-company | 00.000.000/0000-00 | active |

## Step 3: Verify Schema

Run this verification query in Supabase SQL Editor:

```sql
-- Check that z_api_instances has company_id column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'z_api_instances'
AND column_name = 'company_id';
```

Expected output (1 row):
| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| company_id | uuid | YES |

## Step 4: Execute Backfill

After completing steps 1-3, run the backfill script:

```bash
npm run backfill:complete
```

Or directly:

```bash
node scripts/complete_backfill.js
```

## Expected Output

The backfill script will display:

```
================================================================================
COMPLETE Z-API INSTANCES BACKFILL EXECUTION
================================================================================

PHASE 1: Schema Verification
- Companies table: ✓
- Z-API Instances table: ✓  
- company_id column in z_api_instances: ✓

PHASE 2: Initial State Collection
- Total instances: 2
  - With company_id: 0
  - Without company_id: 2

PHASE 3: Default Company Setup
✓ Default company verified: 00000000-0000-0000-0000-000000000001

PHASE 4: Backfilling company_id
✓ Backfill update completed
  - Instances updated: 2

PHASE 5: Final State Verification
- Total instances: 2
  - With company_id: 2
  - Without company_id: 0
✓ Backfill percentage: 100%

PHASE 6: Data Integrity Verification
✓ All instances have company_id

================================================================================
BACKFILL COMPLETION SUMMARY
================================================================================

Statistics:
  Total instances before: 2
  Total instances after: 2
  With company_id before: 0
  With company_id after: 2
  Instances backfilled: 2
  Percentage backfilled: 100%
  Instances lost: 0

Data Integrity:
  ✓ No instances lost
  ✓ All instances have company_id
  ✓ Instance count maintained

OVERALL STATUS: ✅ SUCCESS - All checks passed!
✅ PERFECT MATCH: Expected 2 instances, 2 with company_id - BACKFILL 100% COMPLETE

================================================================================
```

## Verification Query

After backfill completes, run this in Supabase SQL Editor to verify:

```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
  ROUND(COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 2) as percentage
FROM z_api_instances;
```

Expected result:
| total | with_company | percentage |
|-------|--------------|------------|
| 2     | 2            | 100.00     |

## Troubleshooting

### "Table companies already exists"
- This is normal if you run Step 2 multiple times
- The `CREATE TABLE IF NOT EXISTS` and `ON CONFLICT` clauses handle duplicates gracefully

### "column company_id does not exist"  
- Make sure you ran the entire SQL from Step 1
- Check for errors in the Supabase SQL Editor
- The `ALTER TABLE z_api_instances ADD COLUMN` must have executed successfully

### Backfill shows "companies table does not exist"
- Step 1 failed to create the companies table
- Check the Supabase SQL Editor for error messages
- Try running just the CREATE TABLE statement first

### 0 instances were backfilled
- All instances may already have company_id assigned
- This is not an error - the backfill is already complete
- Verify with the verification query above

## Database Schema Created

After completing this setup, you'll have:

### companies table
Stores company/tenant information:
- id: UUID primary key
- name: Company name
- slug: URL-friendly identifier (UNIQUE)
- description: Optional description
- plan: Subscription plan (starter/professional/enterprise)
- status: Active status (active/paused/suspended/cancelled)
- owner_id: UUID of company owner
- cnpj: Brazilian tax ID (00.000.000/0000-00 format)
- metadata: JSONB for custom fields
- settings: JSONB for configuration
- created_at, updated_at: Timestamps
- deleted_at: Soft delete timestamp (optional)

### z_api_instances additions
- company_id: UUID foreign key to companies table
- Indexes for fast lookup by company_id

## SQL File References

The SQL statements are also available in these files:
- `migrations/002_add_company_support.sql` - Schema creation
- `migrations/003_backfill_company_id.sql` - Backfill operations

## Support

For issues:
1. Check the Supabase Dashboard: https://supabase.com/dashboard/project/gqromcfhiosfppqlottz
2. Review SQL Editor error messages
3. Consult: https://supabase.com/docs/guides/database

---

**Last Updated:** 2026-08-13  
**Expected Result:** 2 z_api_instances, both with company_id = 00000000-0000-0000-0000-000000000001
