# IAeZap Multi-Tenant System - SQL Migration Guide

## Overview

This document guides you through executing SQL migrations for the IAeZap multi-tenant system in Supabase. The migrations create:

1. **Companies, Users, and Roles** - Foundation for multi-tenant architecture
2. **CNPJ Support** - Brazilian business tax identification
3. **RLS Policies** - Row-level security for data isolation
4. **API Integration** - Z-API instance management
5. **Master User** - System administrator account

## Prerequisites

- Access to Supabase dashboard
- Project URL: `https://gqromcfhiosfppqlottz.supabase.co`
- Service Role Key available in `.env.local`

## Migration Files

All migration files are located in `/src/lib/auth/`:

1. **001_create_companies_users_roles.sql** - Core tables and functions
2. **002_add_cnpj_to_companies.sql** - Brazilian business ID support
3. **003_complete_multitenant_migration.sql** - RLS policies and API integration

**OR** use the bundled version:
- **migrations/001_complete_migration_bundle.sql** - All migrations combined

## Method 1: Supabase Dashboard SQL Editor (Recommended)

### Steps:

1. **Open Supabase Dashboard**
   - URL: https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "+ New Query"

3. **Copy and Execute Migrations**

   **Option A: Execute Complete Bundle**
   - Open `migrations/001_complete_migration_bundle.sql`
   - Copy entire content
   - Paste into SQL Editor
   - Click "Run" (Ctrl+Enter)

   **Option B: Execute Migrations Sequentially**
   - Execute files in order:
     1. `src/lib/auth/001_create_companies_users_roles.sql`
     2. `src/lib/auth/002_add_cnpj_to_companies.sql`
     3. `src/lib/auth/003_complete_multitenant_migration.sql`

4. **Monitor Execution**
   - Watch for success messages
   - Check for any error messages
   - Review the verification output

## Method 2: PostgreSQL CLI (psql)

### Prerequisites
```bash
# Install PostgreSQL client tools (if not already installed)
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### Execution

```bash
# Navigate to project directory
cd /path/to/iaezap6

# Method 1: Execute complete bundle
psql "postgresql://postgres:[PASSWORD]@gqromcfhiosfppqlottz.supabase.co:5432/postgres?sslmode=require" \
  -f migrations/001_complete_migration_bundle.sql

# Method 2: Execute migrations separately
psql "postgresql://postgres:[PASSWORD]@gqromcfhiosfppqlottz.supabase.co:5432/postgres?sslmode=require" \
  -f src/lib/auth/001_create_companies_users_roles.sql && \
  psql "postgresql://postgres:[PASSWORD]@gqromcfhiosfppqlottz.supabase.co:5432/postgres?sslmode=require" \
  -f src/lib/auth/002_add_cnpj_to_companies.sql && \
  psql "postgresql://postgres:[PASSWORD]@gqromcfhiosfppqlottz.supabase.co:5432/postgres?sslmode=require" \
  -f src/lib/auth/003_complete_multitenant_migration.sql
```

**Note**: Replace `[PASSWORD]` with your database password or use environment variable:
```bash
export PGPASSWORD="your_password"
```

## Method 3: Supabase CLI

### Prerequisites
```bash
npm install -g supabase
# or
brew install supabase/tap/supabase
```

### Execution

```bash
# Link to your project
supabase link --project-ref gqromcfhiosfppqlottz

# Create migrations
supabase db push

# Or manually execute SQL
supabase db execute < migrations/001_complete_migration_bundle.sql
```

## Verification Queries

After executing migrations, verify success using these queries in Supabase SQL Editor:

### 1. Verify Tables Created
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
AND table_name IN ('companies', 'users', 'company_members', 'audit_logs');
```

**Expected Output:**
```
 table_name
─────────────────
 companies
 users
 company_members
 audit_logs
```

### 2. Verify Master User Created
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

**Expected Output:**
```
 id                                   | email                          | full_name   | role  | status | email_verified | created_at
──────────────────────────────────────┼────────────────────────────────┼─────────────┼───────┼────────┼────────────────┼─────────────────
 00000000-0000-0000-0000-000000000002 | kairolopesoficial@gmail.com    | Master Admin | owner | active | t              | 2026-08-13...
```

### 3. Verify Master Company Created
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

**Expected Output:**
```
 id                                   | name            | slug   | plan       | status | owner_id                             | created_at
──────────────────────────────────────┼─────────────────┼────────┼────────────┼────────┼──────────────────────────────────────┼──────────────
 00000000-0000-0000-0000-000000000001 | Master Company  | master | enterprise | active | 00000000-0000-0000-0000-000000000002 | 2026-08-13...
```

### 4. Verify Indexes Created
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

**Expected Output:**
```
 tablename       | index_count
─────────────────┼─────────────
 audit_logs      | 5
 companies       | 6
 company_members | 5
 users           | 7
 z_api_instances | 2
```

### 5. Verify RLS Policies
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected Output:** (Should show RLS policies for companies, users, company_members, and audit_logs)

### 6. Verify company_id Added to z_api_instances
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'z_api_instances'
ORDER BY ordinal_position;
```

**Expected Output:** (Should include `company_id` column with type `USER-DEFINED`)

## Tables Created

### companies
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  plan VARCHAR(50),
  status VARCHAR(50),
  owner_id UUID NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  metadata JSONB,
  settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);
```

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  display_name VARCHAR(100),
  avatar_url TEXT,
  role user_role (enum: owner, admin, member, viewer),
  auth_id UUID UNIQUE,
  password_hash VARCHAR(255),
  status VARCHAR(50),
  email_verified BOOLEAN,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  preferences JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

### company_members
```sql
CREATE TABLE company_members (
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  role user_role,
  joined_at TIMESTAMP WITH TIME ZONE,
  invited_by UUID,
  invite_accepted_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, company_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (invited_by) REFERENCES users(id)
);
```

### audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Indexes Created

### companies
- `idx_companies_slug` - For URL routing
- `idx_companies_owner_id` - For owner lookups
- `idx_companies_status` - For status filtering
- `idx_companies_plan` - For plan-based queries
- `idx_companies_created_at` - For time-based queries
- `idx_companies_status_plan` - Composite for common queries
- `idx_companies_cnpj` - For CNPJ lookups
- `idx_companies_owner_id_active` - For active companies by owner

### users
- `idx_users_email` - For email lookups
- `idx_users_company_email` - Composite for company + email
- `idx_users_company_id` - For company membership
- `idx_users_auth_id` - For external auth integration
- `idx_users_company_role` - For role-based queries
- `idx_users_status` - For status filtering
- `idx_users_last_activity_at` - For activity tracking

### company_members
- `idx_company_members_user_id` - For user lookups
- `idx_company_members_company_id` - For company lookups
- `idx_company_members_role` - For role filtering
- `idx_company_members_invited_by` - For invitation tracking
- `idx_company_members_joined_at` - For membership timeline

### audit_logs
- `idx_audit_logs_company_id` - For company audit trails
- `idx_audit_logs_user_id` - For user actions
- `idx_audit_logs_entity` - For entity tracking
- `idx_audit_logs_action` - For action filtering
- `idx_audit_logs_created_at` - For time-based queries

### z_api_instances
- `idx_z_api_instances_company_id` - For company lookup
- `idx_z_api_instances_instance_id_company` - Composite for API integration

## Functions Created

### update_updated_at_column()
Automatically updates the `updated_at` timestamp when records are modified.

### get_user_companies(p_user_id UUID)
Returns all companies a user belongs to with their roles.

### user_has_company_role(p_user_id, p_company_id, p_required_role)
Checks if a user has a specific role in a company.

### get_company_users(p_company_id UUID)
Returns all users in a company with their roles.

### create_audit_log(...)
Creates audit log entries for tracking changes.

### validate_cnpj()
Validates CNPJ format (Brazilian business ID).

## RLS Policies Configured

### companies
- `users_can_view_own_companies` - Users see companies they belong to
- `owners_can_update_companies` - Only owners can update company data
- `admin_can_insert_companies` - Only admins can create companies

### users
- `users_can_view_company_members` - See other members in their company
- `admins_can_update_users` - Admins can update users in their company
- `users_can_update_own_profile` - Users can update their own profiles

### company_members
- `users_can_view_members` - See members in their company
- `admins_can_manage_members` - Admins can manage memberships

### audit_logs
- `users_can_view_audit_logs` - See audit logs for their company
- `system_can_insert_audit_logs` - System can insert log entries

## Master User Details

After migration, a master user is created with:

- **Email**: `kairolopesoficial@gmail.com`
- **Full Name**: Master Admin
- **Role**: owner
- **Status**: active
- **Company**: Master Company (slug: `master`)
- **Password Hash**: Placeholder bcrypt hash
- **Email Verified**: true

## Troubleshooting

### Issue: "relation already exists"
This is normal. The `CREATE TABLE IF NOT EXISTS` statements handle this gracefully.

### Issue: "type already exists"
The `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` block handles this.

### Issue: RLS Policy errors
Ensure Supabase Auth is configured and `auth.uid()` is available.

### Issue: Foreign key constraint violations
Ensure tables are created in the correct order (companies before users).

## Testing the Migration

After successful migration, test basic functionality:

```sql
-- Test: Query master user
SELECT * FROM users WHERE email = 'kairolopesoficial@gmail.com';

-- Test: Query master company
SELECT * FROM companies WHERE slug = 'master';

-- Test: Verify relationships
SELECT
  u.email,
  u.full_name,
  c.name,
  c.slug
FROM users u
JOIN companies c ON u.company_id = c.id
WHERE u.email = 'kairolopesoficial@gmail.com';

-- Test: Verify RLS is enabled
SELECT * FROM pg_class WHERE relname IN ('companies', 'users') AND relrowsecurity = true;
```

## Next Steps

1. **Link auth_id to Supabase Auth**
   - Update the master user with the actual auth.users.id from Supabase Auth

2. **Create additional users and companies**
   - Use the insert functions and maintain RLS policies

3. **Set up webhooks**
   - Configure Z-API webhooks to create audit logs

4. **Test multi-tenant isolation**
   - Verify users only see their company data

## Support

For issues or questions:
1. Check Supabase logs in the dashboard
2. Review RLS policies configuration
3. Verify all migration files executed successfully
4. Check PostgreSQL error messages in SQL Editor
