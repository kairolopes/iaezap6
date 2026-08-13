# Z-API Instances Company ID Backfill - Execution Guide

**Status**: READY FOR EXECUTION  
**Date**: 2026-08-13  
**Environment**: Supabase (https://gqromcfhiosfppqlottz.supabase.co)

---

## Executive Summary

The backfill migration for `z_api_instances.company_id` has been prepared. **Current database status shows that Migration 002 (adding the company_id column) needs to be applied first.**

### Current Database State

```
companies table: EXISTS ✓
z_api_instances table: EXISTS ✓
z_api_instances.company_id column: MISSING ✗ (Need to add)
```

### What Needs to Be Done

1. **Add company_id column to z_api_instances** (Migration 002 part 2)
2. **Create default company** (Migration 003 step 1)
3. **Backfill company_id values** (Migration 003 step 2)
4. **Verify results** (Migration 003 step 3)

---

## Step-by-Step Execution

### STEP 1: Add company_id Column to z_api_instances

**Location**: Supabase SQL Editor  
**Time Required**: 1-2 minutes

#### SQL to Execute

```sql
-- Add company_id column to z_api_instances
ALTER TABLE IF EXISTS z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);

CREATE INDEX IF NOT EXISTS idx_z_api_instances_instance_id_company
  ON z_api_instances(instance_id, company_id);

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'z_api_instances' AND column_name = 'company_id';
```

**Expected Result**:
```
column_name    | data_type
---------------+-----------
company_id     | uuid
```

---

### STEP 2: Execute Backfill Migration

After Step 1 is complete, run the backfill script:

```bash
npm run backfill:complete
```

Or manually:

```bash
node scripts/full_migration_and_backfill.mjs
```

This script will:
1. ✓ Verify companies table exists
2. ✓ Verify z_api_instances.company_id column exists
3. Create default company (if not exists)
4. Update all NULL company_id values
5. Verify and report results

---

### STEP 3: Verify Results

After the script completes, verify the backfill was successful:

```sql
-- Check overall status
SELECT
  COUNT(*) as total_instances,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company,
  ROUND(100.0 * COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2) as percentage_with_company
FROM z_api_instances;

-- Expected Output:
-- total_instances | with_company | without_company | percentage_with_company
-- --------------- | ------------ | --------------- | -----------------------
--               2 |            2 |               0 |                  100.00
```

```sql
-- Check breakdown by company
SELECT
  c.id,
  c.name,
  c.slug,
  COUNT(z.id) as instance_count
FROM companies c
LEFT JOIN z_api_instances z ON c.id = z.company_id
WHERE c.id = '00000000-0000-0000-0000-000000000001'
GROUP BY c.id, c.name, c.slug;

-- Expected Output:
-- id                                   | name             | slug             | instance_count
-- ------------------------------------ | ---------------- | ---------------- | ---------------
-- 00000000-0000-0000-0000-000000000001 | Default Company  | default-company  |              2
```

---

## Detailed Migration Files

### Migration 002 Part (Add Column)
**File**: `/migrations/002_add_company_support.sql`  
**Status**: Partially applied (companies table exists, but need to add company_id column)

This migration creates:
- ✓ `companies` table
- ✓ Indexes for companies table
- ✗ `company_id` column on z_api_instances (MISSING - needs to be added)

### Migration 003 (Backfill)
**File**: `/migrations/003_backfill_company_id.sql`

This migration performs:
1. Creates default company with:
   - ID: `00000000-0000-0000-0000-000000000001`
   - Name: Default Company
   - Slug: default-company
   - Plan: starter
   - Status: active

2. Updates all z_api_instances where company_id IS NULL

3. Verifies results with queries

---

## Execution Scripts

### Option A: Automated Script (Recommended)
**File**: `/scripts/full_migration_and_backfill.mjs`

```bash
node scripts/full_migration_and_backfill.mjs
```

**Advantages**:
- Automatically checks prerequisites
- Clear progress reporting
- Detailed verification
- Error handling
- Support for .env.local

**Requirements**:
- Node.js 14+
- .env.local with Supabase credentials
- company_id column already added to z_api_instances

### Option B: Manual SQL in Supabase UI

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Create new query
4. Execute the SQL from `/migrations/003_backfill_company_id.sql`

**Advantages**:
- Direct control
- No script dependencies
- Can see immediate results

**Disadvantages**:
- Manual verification required
- More steps involved

---

## Troubleshooting

### Issue: "company_id does not exist"
**Cause**: Step 1 (adding column) hasn't been completed  
**Solution**: Execute Step 1 SQL first in Supabase SQL Editor

### Issue: Script fails to connect
**Cause**: .env.local missing or incorrect credentials  
**Solution**: 
1. Verify .env.local exists
2. Check `SUPABASE_SERVICE_ROLE_KEY` is set
3. Ensure URL matches your Supabase project

### Issue: "permission denied" errors
**Cause**: Using anon key instead of service role key  
**Solution**: Use SUPABASE_SERVICE_ROLE_KEY from .env.local (not NEXT_PUBLIC_SUPABASE_ANON_KEY)

### Issue: Some instances still have NULL company_id
**Cause**: Update didn't execute properly  
**Solution**: 
1. Check that Step 1 completed successfully
2. Verify z_api_instances table structure
3. Run the update query manually:
   ```sql
   UPDATE z_api_instances
   SET company_id = '00000000-0000-0000-0000-000000000001'::uuid,
       updated_at = NOW()
   WHERE company_id IS NULL;
   ```

---

## Safety & Rollback

### Before You Start
1. ✓ Backup your database (if available)
2. ✓ Check that this is not a production critical time
3. ✓ Have Supabase dashboard access ready
4. ✓ Review the SQL to be executed

### If Something Goes Wrong
1. **No data loss occurs** - the migration is additive
2. **To revert**: Set company_id back to NULL (if needed)
   ```sql
   UPDATE z_api_instances
   SET company_id = NULL
   WHERE company_id = '00000000-0000-0000-0000-000000000001';
   ```

---

## Expected Timeline

| Step | Action | Estimated Time | Status |
|------|--------|-----------------|--------|
| 1 | Add company_id column | 1-2 min | PENDING |
| 2 | Create default company | 30 sec | READY |
| 3 | Backfill company_id | 30 sec | READY |
| 4 | Verify results | 1 min | READY |
| **Total** | | **3-4 minutes** | |

---

## Success Criteria

After completion, verify:

✓ All z_api_instances have a company_id  
✓ All company_id values reference the default company  
✓ No NULL values in company_id column  
✓ Percentage backfilled = 100%  
✓ 2 instances associated with default company  

---

## Next Steps After Backfill

1. **Add RLS Policies** (if not already done):
   - Ensure Row-Level Security is configured on companies table
   - Verify users can only access their own company's data

2. **Application Updates** (if needed):
   - Update API endpoints to use company_id for filtering
   - Implement company-based access control
   - Update tests to include company_id

3. **Monitor**:
   - Check application logs for any errors
   - Verify API responses include company_id
   - Test multi-tenant isolation

---

## Quick Reference

### Default Company Details
- **ID**: `00000000-0000-0000-0000-000000000001`
- **Name**: Default Company
- **Slug**: default-company
- **Plan**: starter
- **Status**: active

### Database Connection
- **URL**: https://gqromcfhiosfppqlottz.supabase.co
- **Database**: postgres
- **User**: postgres

### Files
- SQL Migration: `/migrations/003_backfill_company_id.sql`
- Migration SQL (add column): `/migrations/002_add_company_support.sql` (Step 1 only)
- Execution Script: `/scripts/full_migration_and_backfill.mjs`

---

**Created**: 2026-08-13  
**Last Updated**: 2026-08-13  
**Status**: READY FOR EXECUTION

⚠️ **IMPORTANT**: Step 1 (adding company_id column) must be completed first before running the backfill script.
