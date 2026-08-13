# Z-API Instances Company ID Backfill Migration Report

**Date**: 2026-08-13  
**Status**: PENDING - Prerequisite Migration Required

## Executive Summary

The backfill migration for `z_api_instances.company_id` has been prepared and is ready to execute. However, the **prerequisite migration (002) has not yet been applied** to the database.

### Current State
- ✓ Migration files created: `003_backfill_company_id.sql`
- ✓ Execution scripts prepared
- ✗ Database schema not updated (Migration 002 not applied)
- ✗ Companies table does not exist
- ✗ company_id column missing from z_api_instances table

## Prerequisites

### Migration 002 Must Be Applied First
Before executing the backfill migration, the following migration must be applied:
- **File**: `/migrations/002_add_company_support.sql`
- **Purpose**: 
  - Creates the `companies` table with required schema
  - Adds `company_id` column to `z_api_instances` table
  - Sets up indexes for optimal performance

**Status**: PENDING

## Migration 003: Backfill Company ID

### Purpose
Backfill the `company_id` column in `z_api_instances` table with a default company for all NULL values.

### Implementation Steps

#### Step 1: Create Default Company
- **ID**: `00000000-0000-0000-0000-000000000001`
- **Slug**: `default-company`
- **Name**: Default Company
- **Plan**: starter
- **Status**: active
- **Owner ID**: `00000000-0000-0000-0000-000000000000`

#### Step 2: Update z_api_instances
- **Action**: Set `company_id` to default company ID where `company_id IS NULL`
- **Update Timestamp**: Update `updated_at` to current timestamp

#### Step 3: Verification
- **Query**: 
  ```sql
  SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company
  FROM z_api_instances;
  ```
- **Expected Result** (when migration is complete):
  - total = 2
  - with_company = 2
  - Percentage backfilled = 100%

## Files Created

### Migration Scripts
1. **`/migrations/003_backfill_company_id.sql`**
   - Contains full backfill migration SQL
   - Includes verification queries
   - Uses safe PL/pgSQL for idempotent execution

### Execution Scripts
1. **`/scripts/backfill_company_id.mjs`**
   - Direct PostgreSQL connection method
   - Requires database access from execution environment

2. **`/scripts/backfill_company_id_supabase_client.mjs`**
   - Supabase JS client method
   - Recommended for cloud environments
   - Better error handling and feedback

3. **`/scripts/check_schema_and_backfill.mjs`**
   - Checks current schema status
   - Validates prerequisites
   - Applies migrations if prerequisites are met

## How to Execute

### Option 1: Using Supabase SQL Editor (Manual)

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Open `/migrations/002_add_company_support.sql`
4. Execute the migration
5. Then open `/migrations/003_backfill_company_id.sql`
6. Execute the migration

### Option 2: Using Node.js Script (Automated)

Once Migration 002 is applied:
```bash
# Check schema and execute backfill
npm run backfill:company || node scripts/check_schema_and_backfill.mjs

# Or directly:
node scripts/backfill_company_id_supabase_client.mjs
```

## Expected Results

### Before Backfill
```
Total z_api_instances: 2
- With company_id: 0
- Without company_id: 2
- Percentage with company: 0%
```

### After Backfill
```
Total z_api_instances: 2
- With company_id: 2
- Without company_id: 0
- Percentage with company: 100%

Breakdown by Company:
- Default Company (default-company): 2 instances
```

## Verification Queries

### Check Current Status
```sql
SELECT
  COUNT(*) as total_instances,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company,
  ROUND(100.0 * COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) /
    CASE WHEN COUNT(*) = 0 THEN 1 ELSE COUNT(*) END, 2) as percentage_with_company
FROM z_api_instances;
```

### Check Breakdown by Company
```sql
SELECT
  c.id,
  c.name,
  c.slug,
  COUNT(z.id) as instance_count
FROM companies c
LEFT JOIN z_api_instances z ON c.id = z.company_id
GROUP BY c.id, c.name, c.slug
ORDER BY instance_count DESC;
```

## Next Steps

1. **REQUIRED**: Apply Migration 002 first
   - Location: `/migrations/002_add_company_support.sql`
   - This creates the companies table and adds company_id column

2. **THEN**: Apply Migration 003
   - Location: `/migrations/003_backfill_company_id.sql`
   - This fills NULL company_id values with the default company

3. **VERIFY**: Run verification queries to confirm success
   - All z_api_instances should have a company_id
   - All instances should be associated with the default company

## Schema Changes Summary

### New Table: companies
- `id` (UUID, PRIMARY KEY)
- `name` (VARCHAR 255)
- `slug` (VARCHAR 100, UNIQUE)
- `plan` (VARCHAR 50, DEFAULT 'starter')
- `status` (VARCHAR 50, DEFAULT 'active')
- `owner_id` (UUID)
- `cnpj` (VARCHAR 18, nullable)
- `metadata` (JSONB, DEFAULT '{}')
- `settings` (JSONB, DEFAULT '{}')
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)
- `deleted_at` (TIMESTAMP WITH TIME ZONE, nullable)

### Modified Table: z_api_instances
- NEW COLUMN: `company_id` (UUID, FK to companies.id, ON DELETE CASCADE)

### Indexes Created
- `idx_companies_slug` - For fast slug lookups
- `idx_companies_owner_id` - For owner queries
- `idx_companies_status` - For status filtering
- `idx_companies_plan` - For plan queries
- `idx_companies_created_at` - For time-based queries
- `idx_companies_status_plan` - For combined filtering
- `idx_companies_cnpj` - For CNPJ lookups
- `idx_z_api_instances_company_id` - For company queries
- `idx_z_api_instances_instance_id_company` - For compound lookups

## Rollback Instructions

If needed, the migration can be rolled back by:

1. Removing the default company record (if it's not in use)
2. Setting company_id back to NULL (optional)
3. Removing the company_id column from z_api_instances

However, this is not recommended unless there are critical issues.

## Support & Troubleshooting

### Issue: "companies table does not exist"
**Cause**: Migration 002 has not been applied  
**Solution**: Apply `/migrations/002_add_company_support.sql` first

### Issue: "company_id column does not exist"
**Cause**: Migration 002 has not been applied  
**Solution**: Apply `/migrations/002_add_company_support.sql` first

### Issue: Script connection failures
**Cause**: Database not accessible from execution environment  
**Solution**: Use Supabase SQL Editor to execute migrations manually

### Issue: Permission denied errors
**Cause**: Using wrong credentials or insufficient permissions  
**Solution**: Ensure using SUPABASE_SERVICE_ROLE_KEY (not anon key)

---

**Last Updated**: 2026-08-13  
**Created By**: Cloud Migration System  
**Status**: READY FOR EXECUTION (After Migration 002 is applied)
