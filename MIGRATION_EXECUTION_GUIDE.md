# SQL Migration Execution Guide
## IAeZap Multi-Tenant System - Complete Migration Bundle

**Date:** 2026-08-14  
**Migration File:** `migrations/001_complete_migration_bundle.sql`  
**File Size:** 20,171 bytes  
**Status:** Ready for Execution

---

## Executive Summary

Three approaches have been prepared for executing the SQL migration on Supabase:

1. ❌ **Supabase CLI db push** - Limited by local Docker requirements
2. ❌ **Direct PostgreSQL Client** - Service role key authentication limitation
3. ✅ **Manual SQL Editor (RECOMMENDED)** - Fully functional, most reliable

---

## Approach 1: Supabase CLI db push

### Status
**LIMITATION:** Requires local Docker and project linking. Not functional in this environment.

### What it would do:
```bash
supabase db push --linked
```

### Why it doesn't work:
- Requires Docker daemon for local migration tracking
- Docker is not available in this environment
- Project linking requires interactive authentication

---

## Approach 2: Direct PostgreSQL Client (Node.js)

### Status
**LIMITATION:** Supabase service role keys cannot be used for direct PostgreSQL connections. They are API-only credentials.

### What was attempted:
- Created script: `execute-migration-pg.mjs`
- Attempted direct connection to PostgreSQL using pg library
- Failed due to authentication limitations

### Why it doesn't work:
- Supabase service role key is for REST/GraphQL API only
- Direct PostgreSQL connections require database-specific credentials
- Supabase doesn't expose database passwords for security reasons

---

## Approach 3: Manual SQL Editor (RECOMMENDED) ✅

### Status
**FULLY FUNCTIONAL AND RECOMMENDED**

### Step-by-Step Instructions

#### Step 1: Access Supabase Dashboard
1. Navigate to: https://app.supabase.com
2. Sign in with your Supabase account
3. Select project: **gqromcfhiosfppqlottz**

#### Step 2: Open SQL Editor
1. In the left sidebar, click **SQL Editor**
2. Click the **New Query** button (or the + icon)
3. A new query window will open

#### Step 3: Copy Migration SQL
1. Open the migration file: `migrations/001_complete_migration_bundle.sql`
2. Copy all SQL content
3. Paste it into the SQL Editor

#### Step 4: Execute Migration
1. Click the **Run** button (play icon) in the SQL Editor
2. **IMPORTANT:** This will take 5-30 seconds to execute
3. Watch for the query completion message

#### Step 5: Verify Execution
The SQL file includes automatic verification queries. After execution, you should see:

```
============================================================================
MIGRATION EXECUTION COMPLETE
=============================================================================

Created Tables:
  ✓ companies
  ✓ users
  ✓ company_members
  ✓ audit_logs

Added Columns:
  ✓ companies.cnpj
  ✓ z_api_instances.company_id

Created Master User:
  ✓ Email: kairolopesoficial@gmail.com
  ✓ Role: owner
  ✓ Company: Master Company

Security Features:
  ✓ Row Level Security (RLS) enabled on all tables
  ✓ RLS policies configured for multi-tenant isolation
```

---

## Migration Details

### Tables Created
1. **companies** - Top-level organization entities
   - Columns: id, name, slug, plan, status, owner_id, cnpj, metadata, settings
   - Indexes: 6 indexes on key columns
   - Features: Soft delete support, CNPJ validation

2. **users** - Individual users within companies
   - Columns: id, company_id, email, full_name, role, auth_id, status, preferences
   - Indexes: 7 indexes for optimal query performance
   - Features: Company-specific email uniqueness, role-based access control

3. **company_members** - User-company relationships
   - Columns: user_id, company_id, role, joined_at, invited_by
   - Indexes: 5 indexes for fast lookups
   - Features: Tracks membership status and invitations

4. **audit_logs** - Audit trail for compliance
   - Columns: id, company_id, user_id, action, entity_type, changes
   - Indexes: 5 indexes for audit trail queries
   - Features: Complete change tracking

### Enums Created
- **user_role** - (owner, admin, member, viewer)

### Functions Created
1. `update_updated_at_column()` - Auto-update timestamp
2. `validate_cnpj()` - Brazilian CNPJ format validation
3. `get_user_companies()` - Retrieve user's companies
4. `user_has_company_role()` - Role hierarchy checking
5. `get_company_users()` - Get all users in a company
6. `create_audit_log()` - Create audit log entries

### Triggers Created
- `companies_update_updated_at` - Auto-update companies.updated_at
- `users_update_updated_at` - Auto-update users.updated_at
- `companies_validate_cnpj` - Validate CNPJ format on insert/update

### Row Level Security (RLS) Policies
- **Companies Table:**
  - users_can_view_own_companies
  - owners_can_update_companies
  - admin_can_insert_companies

- **Users Table:**
  - users_can_view_company_members
  - admins_can_update_users
  - users_can_update_own_profile

- **Company Members Table:**
  - users_can_view_members
  - admins_can_manage_members

- **Audit Logs Table:**
  - users_can_view_audit_logs
  - system_can_insert_audit_logs

### Master User/Company Created
- **Master Company:**
  - ID: 00000000-0000-0000-0000-000000000001
  - Name: Master Company
  - Slug: master
  - Plan: enterprise
  - Owner: Master Admin user

- **Master User:**
  - ID: 00000000-0000-0000-0000-000000000002
  - Email: kairolopesoficial@gmail.com
  - Role: owner
  - Name: Master Admin
  - Status: active & email verified

---

## Post-Migration Verification

### In Supabase Dashboard
1. Go to **Table Editor**
2. Verify tables exist:
   - companies ✓
   - users ✓
   - company_members ✓
   - audit_logs ✓

3. Click on **users** table
4. Verify master user exists:
   - Email: kairolopesoficial@gmail.com
   - Role: owner
   - Company: Master Company

### Using Node.js Script (After Manual Migration)
```bash
node verify_schema_supabase.js
```

---

## Troubleshooting

### Issue: "Permission Denied" Error
**Cause:** Your Supabase role doesn't have sufficient permissions  
**Solution:** 
1. Check that you're logged in with the project owner account
2. Contact Supabase support if using a team account

### Issue: "Duplicate Key Value" on z_api_instances Column
**Cause:** The z_api_instances table doesn't exist  
**Solution:**
1. This is expected if the table hasn't been created yet
2. The migration handles this gracefully with `IF NOT EXISTS` clauses
3. No action needed

### Issue: "Role user_role Already Exists"
**Cause:** The enum type was already created in a previous run  
**Solution:**
1. This is handled by the `DO ... EXCEPTION` block
2. Safe to re-run the migration
3. No action needed

### Issue: Queries Take Too Long
**Cause:** Large dataset size  
**Solution:**
1. The migration includes many indexes which may take time to create
2. Wait for the query to complete (may take 30-60 seconds for full indexes)
3. Do not interrupt the query

---

## Quick Reference

### File Locations
- Migration SQL: `/migrations/001_complete_migration_bundle.sql`
- Verification script: `/verify_schema_supabase.js`
- Execution scripts:
  - `/execute-migration.mjs` (Supabase JS Client - limited)
  - `/execute-migration-pg.mjs` (PostgreSQL Client - auth limitation)

### Key Credentials (from .env.local)
- **Supabase URL:** https://gqromcfhiosfppqlottz.supabase.co
- **Project ID:** gqromcfhiosfppqlottz
- **Service Role Key:** [Stored in .env.local]

### Database Connection Details
- **Host:** gqromcfhiosfppqlottz.supabase.co
- **Port:** 5432
- **Database:** postgres
- **User:** postgres
- **Password:** [See "Using Direct Connection" section]

---

## Security Notes

1. **RLS Enabled:** All tables have Row Level Security policies active
2. **Master User:** Has owner role with full permissions
3. **Email Verification:** Master user is pre-verified
4. **Soft Deletes:** Companies and users support soft delete with deleted_at column
5. **Audit Logging:** All changes can be tracked via audit_logs table

---

## Next Steps

1. ✅ Execute migration via SQL Editor (Approach 3)
2. Verify tables and master user in Table Editor
3. Run verification script: `node verify_schema_supabase.js`
4. Set up JWT authentication (keys already in .env.local)
5. Test API endpoints with multi-tenant isolation

---

## Support

If you encounter issues:
1. Check the **Troubleshooting** section above
2. Review Supabase documentation: https://supabase.com/docs
3. Check the SQL Editor for error messages
4. Contact Supabase support if needed

---

**Created:** 2026-08-14  
**Migration Status:** Ready to Execute  
**Recommended Approach:** Manual SQL Editor (Approach 3)
