# IAeZap Multi-Tenant Migration - Quick Reference

## Quick Start

### For Supabase Dashboard Users (Easiest)

1. Open: https://app.supabase.com → Your Project → SQL Editor
2. Copy entire content from: `migrations/001_complete_migration_bundle.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify with queries below

### For PostgreSQL CLI Users

```bash
psql "postgresql://postgres:PASSWORD@gqromcfhiosfppqlottz.supabase.co:5432/postgres?sslmode=require" \
  -f migrations/001_complete_migration_bundle.sql
```

---

## What Gets Created (Quick Summary)

### Tables
- **companies** - Organizations/tenants
- **users** - People with roles (owner, admin, member, viewer)
- **company_members** - User-company relationships
- **audit_logs** - Change tracking

### Master Account
- **Email**: kairolopesoficial@gmail.com
- **Role**: owner
- **Company**: Master Company (enterprise plan)

### Security
- RLS enabled on all tables
- 13 RLS policies for data isolation
- CNPJ validation for Brazilian business IDs

### Database Enhancements
- z_api_instances now links to companies
- 25 indexes for optimal query performance
- 7 helper functions for common operations

---

## Verification - 3-Second Test

Run these in SQL Editor to confirm:

### Test 1: Tables exist?
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public'
AND table_name IN ('companies', 'users', 'company_members', 'audit_logs');
```
Expected: `4`

### Test 2: Master user exists?
```sql
SELECT email, role FROM users
WHERE email = 'kairolopesoficial@gmail.com';
```
Expected: `kairolopesoficial@gmail.com | owner`

### Test 3: Master company exists?
```sql
SELECT name, slug FROM companies WHERE slug = 'master';
```
Expected: `Master Company | master`

---

## File Locations

```
iaezap6/
├── migrations/
│   └── 001_complete_migration_bundle.sql  ← USE THIS
├── src/lib/auth/
│   ├── 001_create_companies_users_roles.sql
│   ├── 002_add_cnpj_to_companies.sql
│   └── 003_complete_multitenant_migration.sql
├── MIGRATION_GUIDE.md            ← Full guide
├── SQL_EXECUTION_SUMMARY.md      ← Detailed summary
└── QUICK_REFERENCE.md            ← This file
```

---

## What Each Migration File Does

### 001_create_companies_users_roles.sql (474 lines)
Creates the core multi-tenant structure:
- user_role enum (owner, admin, member, viewer)
- companies table (12 columns, 6 indexes)
- users table (20 columns, 7 indexes)
- company_members table (5 columns, 5 indexes)
- audit_logs table (11 columns, 5 indexes)
- Helper functions

### 002_add_cnpj_to_companies.sql (68 lines)
Adds Brazilian business support:
- cnpj column to companies
- CNPJ validation function
- Additional indexes

### 003_complete_multitenant_migration.sql (325 lines)
Enables security and API integration:
- RLS policies (13 total)
- company_id column to z_api_instances
- Master company and user creation

---

## Complete Table Schemas

### companies
```
id (UUID, PK)
name (VARCHAR 255)
slug (VARCHAR 100, UNIQUE)
description (TEXT)
plan (VARCHAR 50: starter, professional, enterprise)
status (VARCHAR 50: active, paused, suspended, cancelled)
owner_id (UUID)
cnpj (VARCHAR 18, UNIQUE)
metadata (JSONB)
settings (JSONB)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP, nullable)
```

### users
```
id (UUID, PK)
company_id (UUID, FK → companies)
email (VARCHAR 255)
full_name (VARCHAR 255, nullable)
display_name (VARCHAR 100, nullable)
avatar_url (TEXT, nullable)
role (ENUM: owner, admin, member, viewer)
auth_id (UUID, UNIQUE, nullable)
password_hash (VARCHAR 255, nullable)
status (VARCHAR 50: active, inactive, invited, suspended)
email_verified (BOOLEAN)
email_verified_at (TIMESTAMP, nullable)
last_login_at (TIMESTAMP, nullable)
last_activity_at (TIMESTAMP, nullable)
preferences (JSONB)
metadata (JSONB)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP, nullable)
CONSTRAINT: UNIQUE(company_id, email)
```

### company_members
```
user_id (UUID, FK → users, PK)
company_id (UUID, FK → companies, PK)
role (ENUM: owner, admin, member, viewer)
joined_at (TIMESTAMP)
invited_by (UUID, FK → users, nullable)
invite_accepted_at (TIMESTAMP, nullable)
```

### audit_logs
```
id (UUID, PK)
company_id (UUID, FK → companies)
user_id (UUID, FK → users, nullable)
action (VARCHAR 100)
entity_type (VARCHAR 50)
entity_id (UUID, nullable)
old_values (JSONB, nullable)
new_values (JSONB, nullable)
changes (JSONB, nullable)
ip_address (VARCHAR 45, nullable)
user_agent (TEXT, nullable)
created_at (TIMESTAMP)
```

---

## RLS Policies Summary

### companies table
- `users_can_view_own_companies` - See companies you belong to
- `owners_can_update_companies` - Update only if owner
- `admin_can_insert_companies` - Create only if admin

### users table
- `users_can_view_company_members` - See users in your company
- `admins_can_update_users` - Update users in your company
- `users_can_update_own_profile` - Update your own profile

### company_members table
- `users_can_view_members` - View company memberships
- `admins_can_manage_members` - Manage memberships

### audit_logs table
- `users_can_view_audit_logs` - View company audit logs
- `system_can_insert_audit_logs` - System can create logs

---

## Master User Details

```
ID: 00000000-0000-0000-0000-000000000002
Email: kairolopesoficial@gmail.com
Name: Master Admin
Role: owner
Status: active
Company: Master Company
Company ID: 00000000-0000-0000-0000-000000000001
Plan: enterprise
Email Verified: true
Created: 2026-08-13
```

---

## Indexes Created (25 total)

### companies (8)
- idx_companies_slug
- idx_companies_owner_id
- idx_companies_status
- idx_companies_plan
- idx_companies_created_at
- idx_companies_status_plan
- idx_companies_cnpj
- idx_companies_owner_id_active

### users (7)
- idx_users_email
- idx_users_company_email
- idx_users_company_id
- idx_users_auth_id
- idx_users_company_role
- idx_users_status
- idx_users_last_activity_at

### company_members (5)
- idx_company_members_user_id
- idx_company_members_company_id
- idx_company_members_role
- idx_company_members_invited_by
- idx_company_members_joined_at

### audit_logs (5)
- idx_audit_logs_company_id
- idx_audit_logs_user_id
- idx_audit_logs_entity
- idx_audit_logs_action
- idx_audit_logs_created_at

### z_api_instances (2 added)
- idx_z_api_instances_company_id
- idx_z_api_instances_instance_id_company

---

## Functions Created (6)

1. **update_updated_at_column()** - Trigger function for timestamps
2. **validate_cnpj()** - Validate Brazilian business ID format
3. **get_user_companies(user_id)** - Get all companies for a user
4. **user_has_company_role(user_id, company_id, role)** - Check user permissions
5. **get_company_users(company_id)** - Get all users in a company
6. **create_audit_log(...)** - Create audit log entries

---

## Triggers Created (3)

1. **companies_update_updated_at** - Auto-update companies.updated_at
2. **users_update_updated_at** - Auto-update users.updated_at
3. **companies_validate_cnpj** - Validate CNPJ on insert/update

---

## Verification Checklist

After running migrations:

- [ ] All 4 tables exist (companies, users, company_members, audit_logs)
- [ ] Master user created (kairolopesoficial@gmail.com)
- [ ] Master company created (slug: master)
- [ ] 25 indexes created
- [ ] 13 RLS policies enabled
- [ ] company_id column added to z_api_instances
- [ ] user_role enum with 4 values (owner, admin, member, viewer)
- [ ] All 6 functions created

---

## Common Commands

### View all tables
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### View RLS policies
```sql
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### View indexes on a table
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'users'
ORDER BY indexname;
```

### Count records by table
```sql
SELECT 'companies' as table_name, COUNT(*) as count FROM companies
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'company_members', COUNT(*) FROM company_members
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;
```

### View master user
```sql
SELECT * FROM users
WHERE email = 'kairolopesoficial@gmail.com';
```

### View master company
```sql
SELECT * FROM companies
WHERE slug = 'master';
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "type already exists" | user_role enum exists | Safe - migration handles it |
| "relation already exists" | Tables exist | Safe - uses IF NOT EXISTS |
| "UNIQUE constraint" | Duplicate data | Delete existing or use ON CONFLICT |
| "Foreign key violation" | Wrong order | Ensure companies created before users |
| "RLS policy error" | Auth not configured | Safe - enables RLS for future use |

---

## Quick Links

- **Supabase Dashboard**: https://app.supabase.com
- **Full Guide**: See `/MIGRATION_GUIDE.md`
- **SQL Summary**: See `/SQL_EXECUTION_SUMMARY.md`
- **Migration Files**: `/migrations/` and `/src/lib/auth/`

---

## Status

✓ All migration files created  
✓ RLS policies defined  
✓ Master user configured  
✓ Documentation complete  

**Ready for execution!**

---

*Last updated: 2026-08-13*
