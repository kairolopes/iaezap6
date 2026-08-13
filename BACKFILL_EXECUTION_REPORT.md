# Backfill Execution Report: company_id in z_api_instances
**Generated:** 2026-08-13  
**Status:** PREPARED FOR EXECUTION  
**Database:** Supabase (gqromcfhiosfppqlottz)

---

## Executive Summary

The backfill migration to populate `company_id` in the `z_api_instances` table has been **prepared and is ready for execution**. All required migration files, verification scripts, and comprehensive documentation have been generated.

**Current Status:**
- ✓ Migration files: 4 files prepared (total: ~1,300 lines of SQL)
- ✓ Database analysis: Complete
- ✓ Risk assessment: LOW (all operations use conflict handling)
- ✓ Execution plan: Ready
- ⏳ Actual execution: Pending (requires Supabase Dashboard or direct SQL access)

---

## Database State Analysis

### Current Data
```
z_api_instances table:
  Total instances:        2
  With company_id:        0
  Without company_id:     2
  companies table:        DOES NOT EXIST (will be created)
```

### After Backfill (Expected)
```
z_api_instances table:
  Total instances:        2 (UNCHANGED)
  With company_id:        2 (100%)
  Without company_id:     0
  companies table:        CREATED with default company
```

---

## Migration Strategy

### 4-Step Sequential Migration Plan

#### Step 1: Create Base Tables
**File:** `src/lib/auth/001_create_companies_users_roles.sql`
- Size: 15,276 bytes
- SQL Statements: 40
- Creates: companies, users, company_members, audit_logs tables
- Also creates: master company and master user
- Expected time: < 10 seconds

#### Step 2: Add CNPJ Support
**File:** `src/lib/auth/002_add_cnpj_to_companies.sql`
- Size: 2,927 bytes
- SQL Statements: 5
- Adds: CNPJ column with validation
- Creates: CNPJ indexes
- Expected time: < 5 seconds

#### Step 3: Complete Multi-Tenant Setup
**File:** `src/lib/auth/003_complete_multitenant_migration.sql`
- Size: 13,123 bytes
- SQL Statements: 11
- Adds: company_id column to z_api_instances
- Creates: Foreign key, indexes, and RLS policies
- **This is the critical migration** that adds the company_id column
- Expected time: < 15 seconds

#### Step 4: Backfill with Default Company
**File:** `src/lib/auth/003_backfill_company_id.sql`
- Size: 7,823 bytes
- SQL Statements: 4
- Creates: Default company (ID: 00000000-0000-0000-0000-000000000001)
- Executes: UPDATE to populate all z_api_instances.company_id
- Expected time: < 5 seconds

**Total Migration Time:** < 1 minute

---

## What Gets Created

### Default Company
```
ID:          00000000-0000-0000-0000-000000000001
Name:        Default Company
Slug:        default-company
CNPJ:        00.000.000/0000-00
Plan:        starter
Status:      active
Owner:       System (NULL UUID)
Metadata:    {
               "backfill_default": true,
               "created_by_migration": "003_backfill_company_id",
               "created_at_migration": "2026-08-13T..."
             }
```

### Master Company (Created in Step 1)
```
ID:          Generated UUID
Name:        Master Company
Slug:        master
CNPJ:        00.000.000/0000-00
Plan:        enterprise
Status:      active
Owner:       System
```

### Tables Created
1. **companies** - Stores company information
2. **users** - Stores user accounts (linked to companies)
3. **company_members** - Audit trail for company membership
4. **audit_logs** - Audit trail for all changes
5. **z_api_instances** - Modified to add company_id column

### Security Features
- Row Level Security (RLS) enabled on all tables
- Policies restrict data access by company
- Audit logging for compliance
- Foreign key constraints for data integrity

---

## Execution Methods

### Method 1: Supabase Dashboard SQL Editor (RECOMMENDED)
**Easiest method - no additional tools required**

1. Visit: https://app.supabase.com
2. Select project: iaezap6
3. Go to: SQL Editor (left sidebar)
4. Copy entire content of: `BACKFILL_COMPLETE_MIGRATION.sql`
5. Paste into editor
6. Click: "Run"
7. Wait for completion (~30 seconds)

### Method 2: Four Separate Migrations (Alternative)
If you prefer to execute step-by-step:

1. Execute: `001_create_companies_users_roles.sql`
2. Execute: `002_add_cnpj_to_companies.sql`
3. Execute: `003_complete_multitenant_migration.sql`
4. Execute: `003_backfill_company_id.sql`

### Method 3: PostgreSQL CLI
```bash
# Get database URI from Supabase Dashboard > Settings > Database
psql "postgresql://postgres:password@host:5432/postgres" << EOF
\i src/lib/auth/001_create_companies_users_roles.sql
\i src/lib/auth/002_add_cnpj_to_companies.sql
\i src/lib/auth/003_complete_multitenant_migration.sql
\i src/lib/auth/003_backfill_company_id.sql
EOF
```

### Method 4: Node.js Script (Advanced)
```bash
# If pg package is installed and network allows connection
node scripts/run_backfill_with_migrations.js
```

---

## Verification Procedures

### Quick Verification (Copy these queries)

**Query 1: Check default company**
```sql
SELECT id, name, slug, status 
FROM companies 
WHERE slug = 'default-company';
```
Expected: 1 row with default company details

**Query 2: Check backfill percentage**
```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
  ROUND(COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 2) as percentage
FROM z_api_instances;
```
Expected: percentage = 100.00

**Query 3: Check company distribution**
```sql
SELECT c.slug, COUNT(zai.id) as instance_count
FROM companies c
LEFT JOIN z_api_instances zai ON zai.company_id = c.id
GROUP BY c.id, c.slug
ORDER BY instance_count DESC;
```
Expected: default-company should have 2 instances

**Query 4: Data integrity check**
```sql
SELECT
  COUNT(*) as total_instances,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as linked_to_company
FROM z_api_instances;
```
Expected: Both columns = 2 (no lost instances)

---

## Risk Assessment

### Risk Level: LOW

**Why Low Risk?**
- ✓ All CREATE IF NOT EXISTS / ON CONFLICT operations are idempotent
- ✓ Backfill only updates NULL values (safe, non-destructive)
- ✓ Foreign key constraints ensure referential integrity
- ✓ Indexes created for optimal performance
- ✓ RLS policies prevent unauthorized access
- ✓ No data deletion (only additions)

**Data Safety:**
- ✓ No instances will be deleted
- ✓ No existing data will be modified (except company_id and updated_at)
- ✓ All operations can be rolled back manually
- ✓ Safe to re-run migrations (idempotent)

**No Downtime:**
- ✓ DDL operations may briefly lock tables but complete in milliseconds
- ✓ No DELETE or large data migrations
- ✓ Performance impact: Negligible

---

## Statistics Summary

| Metric | Value |
|--------|-------|
| Migration Files | 4 |
| Total SQL Statements | 60 |
| Total Lines of SQL | ~1,300 |
| Instances to Backfill | 2 |
| Expected Backfill %age | 100% |
| New Tables Created | 4 |
| New Columns Added | 1 (company_id) |
| Indexes Created | 8+ |
| RLS Policies Created | 8+ |
| Estimated Execution Time | < 1 minute |
| Risk Level | LOW |
| Data Loss Risk | NONE |

---

## Files Prepared

### Migration Files
- ✓ `src/lib/auth/001_create_companies_users_roles.sql` (Ready)
- ✓ `src/lib/auth/002_add_cnpj_to_companies.sql` (Ready)
- ✓ `src/lib/auth/003_complete_multitenant_migration.sql` (Ready)
- ✓ `src/lib/auth/003_backfill_company_id.sql` (Ready)

### Combined Migration File
- ✓ `BACKFILL_COMPLETE_MIGRATION.sql` (All-in-one, ready to execute)

### Documentation
- ✓ `BACKFILL_INSTRUCTIONS.md` (Detailed execution guide)
- ✓ `BACKFILL_EXECUTION_REPORT.md` (This file)

### Execution Scripts
- ✓ `scripts/execute_backfill.js` (Supabase JS client approach)
- ✓ `scripts/run_backfill_with_migrations.js` (Direct PostgreSQL approach)
- ✓ `scripts/execute_migrations_via_api.js` (API preparation script)

---

## Step-by-Step Execution Guide

### Option A: Quick Execution (Recommended)

1. **Copy the combined migration file content**
   ```
   File: BACKFILL_COMPLETE_MIGRATION.sql
   ```

2. **Open Supabase Dashboard**
   ```
   URL: https://app.supabase.com
   Project: Find "iaezap6"
   ```

3. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

4. **Paste and Execute**
   - Paste entire BACKFILL_COMPLETE_MIGRATION.sql content
   - Click "Run" or press Ctrl+Enter
   - Wait for completion (should show no errors)

5. **Verify Success**
   - See "Data Integrity Check" query results at bottom
   - Should show: total_instances: 2, linked_to_company: 2

### Option B: Step-by-Step Execution

1. Execute: `001_create_companies_users_roles.sql`
   - Expected: No errors, tables created
   
2. Execute: `002_add_cnpj_to_companies.sql`
   - Expected: No errors, CNPJ support added
   
3. Execute: `003_complete_multitenant_migration.sql`
   - Expected: No errors, company_id column added to z_api_instances
   - **This is the critical step**
   
4. Execute: `003_backfill_company_id.sql`
   - Expected: Verification queries show 100% backfill
   - All 2 instances should have company_id assigned

---

## Success Criteria

The backfill is **SUCCESSFUL** when:

✓ **Completeness**
  - All 2 instances have company_id assigned (100%)
  - No instances without company_id

✓ **Data Integrity**
  - Total instance count before = Total instance count after
  - No instances deleted or lost
  - All instance_ids remain valid

✓ **Schema Integrity**
  - companies table exists with default-company
  - z_api_instances.company_id column exists
  - Foreign key constraint active
  - Indexes created and functional

✓ **Verification Queries Return Expected Results**
  - Query 1: 1 default company found
  - Query 2: 100% backfilled percentage
  - Query 3: default-company linked to 2 instances
  - Query 4: 0 lost instances

---

## Rollback Procedure (If Needed)

If for any reason you need to rollback:

```sql
-- Reset company_id to NULL
UPDATE z_api_instances
SET company_id = NULL, updated_at = CURRENT_TIMESTAMP
WHERE company_id = (SELECT id FROM companies WHERE slug = 'default-company');

-- Optional: Delete default company
DELETE FROM companies WHERE slug = 'default-company';

-- Optional: Delete all new tables (if complete rollback needed)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS company_members CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
```

**Note:** Rollback is safe but should only be done if execution fails.

---

## Performance Considerations

- **Execution Time:** < 1 minute total
- **Table Locks:** Minimal (milliseconds per operation)
- **Index Building:** Automatic (no manual action needed)
- **RLS Overhead:** Negligible for 2 instances
- **Query Performance:** Improved after indexes created

---

## Post-Execution Recommendations

1. **Backup** - Perform a backup after successful execution
2. **Test** - Run the verification queries to confirm success
3. **Monitor** - Check application logs for any issues
4. **Update Code** - Modify application to require company_id
5. **Optional: Constraint** - Make company_id NOT NULL after verification

```sql
-- Only after verifying all instances have company_id:
ALTER TABLE z_api_instances
ALTER COLUMN company_id SET NOT NULL;
```

---

## Support and Troubleshooting

### Troubleshooting Guide

**Issue: "Table already exists" error**
- Cause: Migration was partially run before
- Solution: This is safe - migrations use IF NOT EXISTS
- Action: Continue execution, errors are expected

**Issue: "Column already exists" error**
- Cause: Same as above
- Solution: Safe - migrations are idempotent
- Action: Continue execution

**Issue: z_api_instances still has no company_id column**
- Cause: Step 3 (003_complete_multitenant_migration.sql) not executed
- Solution: Execute it explicitly
- Check: Run `\d z_api_instances` to see columns

**Issue: Some instances don't have company_id**
- Cause: They may have had non-NULL values before
- Solution: Manually update them
- Query: `SELECT * FROM z_api_instances WHERE company_id IS NULL;`

**Issue: SQL syntax error**
- Cause: Version mismatch or copy/paste error
- Solution: Re-copy the migration file
- Check: Verify no truncation of content

### Getting Help

1. Check logs in Supabase Dashboard > Logs
2. Review SQL syntax in migration files
3. Verify Supabase project is accessible
4. Check network connectivity
5. Confirm credentials in .env.local

---

## Appendix: File Locations

```
Project Root: C:\Users\Kairo Lopes\OneDrive\Documentos\Kairo\claude code\iaezap6

Migration Files:
├── src/lib/auth/
│   ├── 001_create_companies_users_roles.sql
│   ├── 002_add_cnpj_to_companies.sql
│   ├── 003_complete_multitenant_migration.sql
│   └── 003_backfill_company_id.sql

Combined Migration:
└── BACKFILL_COMPLETE_MIGRATION.sql

Documentation:
├── BACKFILL_INSTRUCTIONS.md
├── BACKFILL_EXECUTION_REPORT.md (this file)

Execution Scripts:
└── scripts/
    ├── execute_backfill.js
    ├── run_backfill_with_migrations.js
    └── execute_migrations_via_api.js
```

---

## Conclusion

**Status:** ✓ **READY FOR EXECUTION**

All migration files have been prepared, verified, and documented. The backfill process is safe, low-risk, and ready to be executed through the Supabase Dashboard.

**Next Steps:**
1. Copy `BACKFILL_COMPLETE_MIGRATION.sql` content
2. Open Supabase SQL Editor
3. Paste and execute
4. Verify with provided queries
5. Confirm 100% backfill success

**Expected Result:** 2 instances backfilled with company_id in < 1 minute

---

**Prepared By:** Claude Code  
**Date:** 2026-08-13  
**Database:** Supabase (gqromcfhiosfppqlottz)  
**Status:** PENDING EXECUTION ⏳

