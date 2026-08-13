# Backfill company_id in z_api_instances - Execution Instructions

This document provides detailed instructions for executing the backfill migration to populate `company_id` in the `z_api_instances` table.

## Overview

The backfill process consists of 4 migration files that must be executed in order:
1. `001_create_companies_users_roles.sql` - Creates base tables and roles
2. `002_add_cnpj_to_companies.sql` - Adds CNPJ column to companies
3. `003_complete_multitenant_migration.sql` - Adds company_id column to z_api_instances and creates RLS policies
4. `003_backfill_company_id.sql` - Populates company_id with default company

## Quick Summary

**Status Before Backfill:**
- Total z_api_instances: 2 instances
- Instances with company_id: 0
- Instances without company_id: 2
- companies table: Does not exist yet (will be created)

## Execution Methods

### Method 1: Supabase SQL Editor (RECOMMENDED - Easiest)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Copy and paste each migration file in order:

#### Step 1: Create companies and users tables
Execute: `src/lib/auth/001_create_companies_users_roles.sql`
**Expected output:** Tables created successfully

#### Step 2: Add CNPJ support
Execute: `src/lib/auth/002_add_cnpj_to_companies.sql`
**Expected output:** Column added successfully

#### Step 3: Complete multitenant setup
Execute: `src/lib/auth/003_complete_multitenant_migration.sql`
**Expected output:** This adds the `company_id` column to `z_api_instances`, creates indexes, and sets up RLS policies

#### Step 4: Backfill with default company
Execute: `src/lib/auth/003_backfill_company_id.sql`
**Expected output:** All z_api_instances will be linked to the default company

### Method 2: PostgreSQL Command Line (psql)

If you have `psql` installed and access to your Supabase database:

```bash
# First, get your database URL from Supabase dashboard:
# Settings > Database > Connection string > URI

psql "your-database-uri" << EOF
\i src/lib/auth/001_create_companies_users_roles.sql
\i src/lib/auth/002_add_cnpj_to_companies.sql
\i src/lib/auth/003_complete_multitenant_migration.sql
\i src/lib/auth/003_backfill_company_id.sql
EOF
```

### Method 3: Supabase CLI

If you have Supabase CLI installed:

```bash
# Push migrations to your Supabase project
supabase db push

# Or execute migrations manually
supabase migration new backfill_company_id
# Then copy the migration file content into the generated file
```

### Method 4: Node.js Script (Requires pg package)

```bash
# Install pg if not already installed
npm install pg

# Run the backfill script
node scripts/run_backfill_with_migrations.js
```

**Note:** This method requires direct database access and may be blocked by network restrictions.

## Verification

After executing all migrations, verify the backfill was successful:

### Query 1: Check companies table
```sql
SELECT id, name, slug, cnpj, status 
FROM companies 
WHERE slug = 'default-company';
```
**Expected:** One row with the default company (ID: 00000000-0000-0000-0000-000000000001)

### Query 2: Check z_api_instances backfill
```sql
SELECT
  COUNT(*) as total_instances,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company_id,
  ROUND(COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 2) as percentage_backfilled
FROM z_api_instances;
```
**Expected:** 
- total_instances: 2
- with_company_id: 2
- without_company_id: 0
- percentage_backfilled: 100.00

### Query 3: Check company distribution
```sql
SELECT
  c.slug,
  c.name,
  COUNT(zai.id) as instance_count
FROM companies c
LEFT JOIN z_api_instances zai ON zai.company_id = c.id
GROUP BY c.id, c.slug, c.name
ORDER BY instance_count DESC;
```
**Expected:** Default company should have 2 instances

### Query 4: Check data integrity
```sql
SELECT
  COUNT(*) as total_instances,
  COUNT(CASE WHEN instance_id IS NOT NULL THEN 1 END) as valid_instance_ids,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as linked_to_company
FROM z_api_instances;
```
**Expected:**
- total_instances: 2
- valid_instance_ids: 2
- linked_to_company: 2

### Query 5: View backfilled instances
```sql
SELECT
  zai.id,
  zai.instance_id,
  zai.tenant_id,
  zai.company_id,
  c.slug as company_slug,
  c.name as company_name,
  zai.created_at,
  zai.updated_at
FROM z_api_instances zai
LEFT JOIN companies c ON zai.company_id = c.id
ORDER BY zai.updated_at DESC;
```
**Expected:** All 2 instances should be linked to 'default-company'

## Success Criteria

The backfill is successful when:
✓ Total instances before = Total instances after (no data loss)
✓ 100% of instances have company_id assigned
✓ All instances are linked to the default company
✓ Data integrity maintained (no missing instance_ids)

## What Gets Created

### Default Company
- **ID:** `00000000-0000-0000-0000-000000000001`
- **Name:** Default Company
- **Slug:** default-company
- **CNPJ:** 00.000.000/0000-00
- **Plan:** starter
- **Status:** active
- **Metadata:** Includes `backfill_default: true` and migration info

### Tables Created
- `companies` - Holds company information
- `users` - Holds user accounts with multi-tenant support
- `company_members` - Links users to companies with roles
- `audit_logs` - Audit trail for changes
- Column added to `z_api_instances`: `company_id` UUID (FK to companies)

### Security Policies (RLS)
Row Level Security is enabled on all tables to ensure data isolation between companies.

## Rollback (If Needed)

To rollback the backfill (WARNING: This removes all company associations):

```sql
-- Reset company_id in z_api_instances to NULL
UPDATE z_api_instances
SET company_id = NULL, updated_at = CURRENT_TIMESTAMP
WHERE company_id = (SELECT id FROM companies WHERE slug = 'default-company');

-- Delete the default company
DELETE FROM companies
WHERE slug = 'default-company';

-- Verify rollback
SELECT COUNT(*) as remaining_instances_with_company FROM z_api_instances WHERE company_id IS NOT NULL;
SELECT COUNT(*) as default_companies FROM companies WHERE slug = 'default-company';
```

## Troubleshooting

### "Table already exists" errors
These are expected if the migrations have been partially run. The migrations use `IF NOT EXISTS` clauses, so re-running them is safe.

### "Column already exists" errors
Same as above - these are expected and safe. The schema changes are idempotent.

### z_api_instances still has no company_id column
Make sure `003_complete_multitenant_migration.sql` has been executed. This migration adds the column.

### Some instances don't have company_id after backfill
Check if they had `NULL` company_id values before. The UPDATE statement only fills `NULL` values. If there's an issue, manually verify with:
```sql
SELECT * FROM z_api_instances WHERE company_id IS NULL;
```

## Performance Notes

- The backfill operation is fast (instant for 2 instances)
- Indexes are created on `company_id` for optimal query performance
- RLS policies may slightly impact query performance (typically negligible)

## Next Steps

After successful backfill:
1. Update application code to require company_id in z_api_instances
2. Optionally: Make company_id NOT NULL (after testing)
3. Implement company-specific logic in API endpoints
4. Set up proper company management in admin panel

## Support

Migration files:
- `src/lib/auth/001_create_companies_users_roles.sql` (580 lines)
- `src/lib/auth/002_add_cnpj_to_companies.sql` (85 lines)
- `src/lib/auth/003_complete_multitenant_migration.sql` (410 lines)
- `src/lib/auth/003_backfill_company_id.sql` (229 lines)

Total: ~1,300 lines of SQL across 4 migration files

**Execution Status Report:**
- Required migrations: 4
- Prerequisites satisfied: No (companies table needs to be created)
- Estimated execution time: < 1 minute
- Data at risk: No (all operations are additive with ON CONFLICT handling)
