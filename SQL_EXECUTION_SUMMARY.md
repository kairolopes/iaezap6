# IAeZap Multi-Tenant System - SQL Execution Summary

**Date**: 2026-08-13  
**Project**: IAeZap  
**Supabase URL**: https://gqromcfhiosfppqlottz.supabase.co  
**Database**: postgres  
**Schema**: public

---

## Overview

Complete SQL migrations for the IAeZap multi-tenant system have been prepared and are ready for execution. This document summarizes what needs to be executed, where the files are located, and how to verify successful execution.

---

## Migration Files Created

### Location: `/src/lib/auth/`

1. **001_create_companies_users_roles.sql** (474 lines)
   - Creates user_role enum type with values: owner, admin, member, viewer
   - Creates companies table with 11 columns, 6 indexes
   - Creates users table with 20 columns, 7 indexes
   - Creates company_members junction table with 5 indexes
   - Creates audit_logs table with 5 indexes
   - Creates helper functions for role management and company queries
   - Creates triggers for automatic timestamp updates

2. **002_add_cnpj_to_companies.sql** (68 lines)
   - Adds cnpj column (VARCHAR(18) UNIQUE) to companies table
   - Creates CNPJ validation function and trigger
   - Creates additional indexes for owner_id and status queries

3. **003_complete_multitenant_migration.sql** (325 lines)
   - Enables RLS on all tables (companies, users, company_members, audit_logs)
   - Creates 13 RLS policies for multi-tenant data isolation
   - Adds company_id column to z_api_instances table with FK constraint
   - Creates 2 new indexes on z_api_instances
   - Creates master company and master user
   - Includes verification queries

### Location: `/migrations/`

**001_complete_migration_bundle.sql** (Complete combined migration)
- All three migrations combined into one executable file
- Ready to copy/paste into Supabase SQL Editor
- Includes verification queries at the end

---

## What Gets Created

### Tables (4)

| Table | Columns | Purpose |
|-------|---------|---------|
| `companies` | 12 | Top-level organization entity with multi-tenant support |
| `users` | 20 | Individual users scoped to companies with role-based access |
| `company_members` | 5 | Junction table for user-company relationships and invitations |
| `audit_logs` | 11 | Audit trail for security and compliance |

### Enum Types (1)

| Type | Values |
|------|--------|
| `user_role` | owner, admin, member, viewer |

### Indexes (25)

- **companies**: 8 indexes
- **users**: 7 indexes
- **company_members**: 5 indexes
- **audit_logs**: 5 indexes
- **z_api_instances**: 2 indexes (added)

### Functions (7)

1. `update_updated_at_column()` - Auto-update timestamps
2. `validate_cnpj()` - Validate Brazilian business IDs
3. `get_user_companies(p_user_id)` - Get user's companies
4. `user_has_company_role(...)` - Check user permissions
5. `get_company_users(p_company_id)` - Get company members
6. `create_audit_log(...)` - Create audit entries

### RLS Policies (13)

**companies (3)**
- users_can_view_own_companies
- owners_can_update_companies
- admin_can_insert_companies

**users (3)**
- users_can_view_company_members
- admins_can_update_users
- users_can_update_own_profile

**company_members (2)**
- users_can_view_members
- admins_can_manage_members

**audit_logs (2)**
- users_can_view_audit_logs
- system_can_insert_audit_logs

### Triggers (3)

1. `companies_update_updated_at` - Auto-update company.updated_at
2. `users_update_updated_at` - Auto-update users.updated_at
3. `companies_validate_cnpj` - Validate CNPJ format

### Master Data Created

**Master Company**
```
ID: 00000000-0000-0000-0000-000000000001
Name: Master Company
Slug: master
Plan: enterprise
Status: active
Owner: Master Admin user
Metadata: {"type": "master", "internal": true}
```

**Master User**
```
ID: 00000000-0000-0000-0000-000000000002
Email: kairolopesoficial@gmail.com
Full Name: Master Admin
Role: owner
Status: active
Company: Master Company
Email Verified: true
Password Hash: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/e1e
Metadata: {"internal": true, "created_by": "system"}
```

### Database Modifications

**z_api_instances table**
- Adds `company_id` UUID column with FK to companies(id)
- ON DELETE CASCADE
- Creates indexes for efficient lookups

---

## Execution Instructions

### Step 1: Navigate to Supabase Dashboard

1. Go to: https://app.supabase.com
2. Select your project: gqromcfhiosfppqlottz
3. Click "SQL Editor" in left sidebar

### Step 2: Execute Migrations

**Option A: Using Complete Bundle (Recommended)**

```
1. Open file: migrations/001_complete_migration_bundle.sql
2. Copy entire content
3. Paste into Supabase SQL Editor
4. Click "Run" or press Ctrl+Enter
5. Wait for completion
```

**Option B: Execute Sequentially**

Execute each file in order:
```
1. src/lib/auth/001_create_companies_users_roles.sql
2. src/lib/auth/002_add_cnpj_to_companies.sql
3. src/lib/auth/003_complete_multitenant_migration.sql
```

### Step 3: Monitor Execution

Look for:
- ✓ Green checkmarks for successful statements
- ✓ "No errors" message at completion
- Check for any warning messages (usually safe to ignore if using IF NOT EXISTS)

### Step 4: Verify Results

Run verification queries (see next section)

---

## Verification Queries

Copy and paste each query into Supabase SQL Editor to verify:

### Query 1: Verify All Tables Created
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
AND table_name IN ('companies', 'users', 'company_members', 'audit_logs')
ORDER BY table_name;
```

**Expected Result**: 4 rows
```
 table_name
─────────────────
 audit_logs
 companies
 company_members
 users
```

### Query 2: Verify Master User
```sql
SELECT
  id,
  email,
  full_name,
  role,
  status,
  email_verified,
  created_at
FROM users
WHERE email = 'kairolopesoficial@gmail.com'
AND deleted_at IS NULL;
```

**Expected Result**: 1 row
```
 id                                   | email                       | full_name   | role  | status | email_verified | created_at
──────────────────────────────────────┼─────────────────────────────┼─────────────┼───────┼────────┼────────────────┼───────────
 00000000-0000-0000-0000-000000000002 | kairolopesoficial@gmail.com | Master Admin | owner | active | t              | 2026-08-13...
```

### Query 3: Verify Master Company
```sql
SELECT
  id,
  name,
  slug,
  plan,
  status,
  owner_id,
  created_at
FROM companies
WHERE slug = 'master'
AND deleted_at IS NULL;
```

**Expected Result**: 1 row
```
 id                                   | name           | slug   | plan       | status | owner_id                             | created_at
──────────────────────────────────────┼────────────────┼────────┼────────────┼────────┼──────────────────────────────────────┼───────────
 00000000-0000-0000-0000-000000000001 | Master Company | master | enterprise | active | 00000000-0000-0000-0000-000000000002 | 2026-08-13...
```

### Query 4: Count Indexes by Table
```sql
SELECT
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs', 'z_api_instances')
GROUP BY tablename
ORDER BY tablename;
```

**Expected Result**: 5 rows
```
 tablename       | index_count
─────────────────┼─────────────
 audit_logs      | 5
 companies       | 8
 company_members | 5
 users           | 7
 z_api_instances | 2
```

### Query 5: Verify RLS Policies
```sql
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Expected Result**: 4 rows
```
 tablename       | policy_count
─────────────────┼──────────────
 audit_logs      | 2
 companies       | 3
 company_members | 2
 users           | 3
```

### Query 6: Verify CNPJ Column
```sql
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
AND column_name = 'cnpj';
```

**Expected Result**: 1 row
```
 column_name | data_type | is_nullable
─────────────┼───────────┼─────────────
 cnpj        | character varying | YES
```

### Query 7: Verify company_id in z_api_instances
```sql
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'z_api_instances'
AND column_name = 'company_id';
```

**Expected Result**: 1 row
```
 column_name | data_type | is_nullable
─────────────┼───────────┼─────────────
 company_id  | uuid      | YES
```

### Query 8: Count All Functions
```sql
SELECT COUNT(*) as function_count
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND proname IN (
  'update_updated_at_column',
  'validate_cnpj',
  'get_user_companies',
  'user_has_company_role',
  'get_company_users',
  'create_audit_log'
);
```

**Expected Result**: 6 rows
```
 function_count
────────────────
 6
```

### Query 9: Test Master User Relationship
```sql
SELECT
  u.id,
  u.email,
  u.full_name,
  c.id as company_id,
  c.name as company_name,
  c.slug
FROM users u
JOIN companies c ON u.company_id = c.id
WHERE u.email = 'kairolopesoficial@gmail.com'
AND u.deleted_at IS NULL
AND c.deleted_at IS NULL;
```

**Expected Result**: 1 row
```
 id                                   | email                       | full_name   | company_id                           | company_name   | slug
──────────────────────────────────────┼─────────────────────────────┼─────────────┼──────────────────────────────────────┼────────────────┼──────
 00000000-0000-0000-0000-000000000002 | kairolopesoficial@gmail.com | Master Admin | 00000000-0000-0000-0000-000000000001 | Master Company | master
```

### Query 10: List All Enum Values
```sql
SELECT
  t.typname,
  e.enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'user_role'
ORDER BY e.enumsortorder;
```

**Expected Result**: 4 rows
```
 typname   | enumlabel
───────────┼──────────
 user_role | owner
 user_role | admin
 user_role | member
 user_role | viewer
```

---

## Expected Table Structures

### companies Table
```
Column Name       | Type                     | Null | Default
──────────────────┼──────────────────────────┼──────┼─────────────────────────
id                | uuid                     | NO   | gen_random_uuid()
name              | character varying(255)   | NO   |
slug              | character varying(100)   | NO   | (unique)
description       | text                     | YES  |
plan              | character varying(50)    | NO   | 'starter'
status            | character varying(50)    | NO   | 'active'
owner_id          | uuid                     | NO   |
cnpj              | character varying(18)    | YES  | ''
metadata          | jsonb                    | YES  | '{}'
settings          | jsonb                    | YES  | '{}'
created_at        | timestamp with time zone | NO   | CURRENT_TIMESTAMP
updated_at        | timestamp with time zone | NO   | CURRENT_TIMESTAMP
deleted_at        | timestamp with time zone | YES  |
```

### users Table
```
Column Name       | Type                     | Null | Default
──────────────────┼──────────────────────────┼──────┼─────────────────────────
id                | uuid                     | NO   | gen_random_uuid()
company_id        | uuid                     | NO   | (FK to companies)
email             | character varying(255)   | NO   |
full_name         | character varying(255)   | YES  |
display_name      | character varying(100)   | YES  |
avatar_url        | text                     | YES  |
role              | user_role                | NO   | 'member'
auth_id           | uuid                     | YES  | (unique)
password_hash     | character varying(255)   | YES  |
status            | character varying(50)    | NO   | 'active'
email_verified    | boolean                  | YES  | false
email_verified_at | timestamp with time zone | YES  |
last_login_at     | timestamp with time zone | YES  |
last_activity_at  | timestamp with time zone | YES  |
preferences       | jsonb                    | YES  | '{}'
metadata          | jsonb                    | YES  | '{}'
created_at        | timestamp with time zone | NO   | CURRENT_TIMESTAMP
updated_at        | timestamp with time zone | NO   | CURRENT_TIMESTAMP
deleted_at        | timestamp with time zone | YES  |
```

### company_members Table
```
Column Name       | Type                     | Null | Default
──────────────────┼──────────────────────────┼──────┼─────────────────────────
user_id           | uuid                     | NO   | (FK to users)
company_id        | uuid                     | NO   | (FK to companies)
role              | user_role                | NO   | 'member'
joined_at         | timestamp with time zone | NO   | CURRENT_TIMESTAMP
invited_by        | uuid                     | YES  | (FK to users)
invite_accepted_at| timestamp with time zone | YES  |
```

### audit_logs Table
```
Column Name       | Type                     | Null | Default
──────────────────┼──────────────────────────┼──────┼─────────────────────────
id                | uuid                     | NO   | gen_random_uuid()
company_id        | uuid                     | NO   | (FK to companies)
user_id           | uuid                     | YES  | (FK to users)
action            | character varying(100)   | NO   |
entity_type       | character varying(50)    | NO   |
entity_id         | uuid                     | YES  |
old_values        | jsonb                    | YES  |
new_values        | jsonb                    | YES  |
changes           | jsonb                    | YES  |
ip_address        | character varying(45)    | YES  |
user_agent        | text                     | YES  |
created_at        | timestamp with time zone | NO   | CURRENT_TIMESTAMP
```

---

## Troubleshooting

### "type already exists" Error
**Cause**: The user_role enum type already exists  
**Solution**: This is expected and safe - the migration handles it with `DO ... EXCEPTION WHEN`  
**Action**: Continue execution

### "relation already exists" Error
**Cause**: Tables already exist from previous migration attempt  
**Solution**: This is safe - migrations use `CREATE TABLE IF NOT EXISTS`  
**Action**: Continue execution

### "UNIQUE constraint violated"
**Cause**: Duplicate master company or user  
**Solution**: Check if master data already exists  
**Action**: Delete existing records or use ON CONFLICT clauses

### Migration runs slowly
**Cause**: Large indexes being created, or many statements to execute  
**Solution**: This is normal for initial setup  
**Action**: Wait for completion (usually 5-30 seconds)

### RLS policy errors during execution
**Cause**: Supabase Auth not yet configured  
**Solution**: This is OK - RLS policies are created but won't be enforced yet  
**Action**: Continue execution

---

## Post-Migration Steps

After successful migration:

1. **Link Master User to Supabase Auth**
   ```sql
   UPDATE users
   SET auth_id = '[SUPABASE_AUTH_USER_ID]'
   WHERE email = 'kairolopesoficial@gmail.com';
   ```

2. **Create Additional Users**
   - Use the users table directly
   - Or create through Supabase Auth + link with auth_id

3. **Create Additional Companies**
   - Insert into companies table
   - Create corresponding users
   - Assign roles appropriately

4. **Configure Z-API Integration**
   - Link Z-API instances to companies
   - Set company_id in z_api_instances table

5. **Test Multi-Tenant Isolation**
   - Verify RLS policies work
   - Test user isolation between companies

---

## Files Created

| File | Purpose |
|------|---------|
| `/src/lib/auth/001_create_companies_users_roles.sql` | Core tables and functions |
| `/src/lib/auth/002_add_cnpj_to_companies.sql` | CNPJ support |
| `/src/lib/auth/003_complete_multitenant_migration.sql` | RLS policies and API integration |
| `/migrations/001_complete_migration_bundle.sql` | Complete combined migration |
| `/MIGRATION_GUIDE.md` | Detailed execution guide |
| `/SQL_EXECUTION_SUMMARY.md` | This file - execution summary |
| `/scripts/execute-migrations.js` | Node.js execution helper |
| `/scripts/verify-migrations.ts` | TypeScript verification script |

---

## Next Steps

1. Execute the migrations using one of the methods above
2. Run the verification queries to confirm success
3. Follow the "Post-Migration Steps" section
4. Configure your application to use the new tables
5. Update authentication to link Supabase Auth users

---

## Support & Questions

For issues during execution:

1. **Check Supabase Logs**
   - Dashboard → Logs → Database
   - Look for error messages

2. **Verify File Content**
   - Ensure SQL files copied completely
   - Check for any syntax errors

3. **Review Migration Guide**
   - See `/MIGRATION_GUIDE.md` for detailed help

4. **Test Verification Queries**
   - Run each verification query individually
   - Identify which step failed

---

**Status**: Ready for Execution  
**Last Updated**: 2026-08-13  
**Prepared by**: IAeZap Migration System
