# Migration 001: Companies, Users, and Roles

**File:** `src/lib/auth/001_create_companies_users_roles.sql`

**Status:** Ready-to-execute | Production-ready | No dependencies

## What This Migration Creates

### 1. **user_role Enum Type**
```sql
CREATE TYPE user_role AS ENUM (
  'owner',      -- Full access
  'admin',      -- Administrative access
  'member',     -- Standard access
  'viewer'      -- Read-only access
);
```

### 2. **companies Table**
Root entity for organizations. Key features:
- `id` - UUID primary key
- `slug` - URL-friendly identifier (UNIQUE)
- `plan` - Subscription tier (starter|professional|enterprise)
- `status` - Current state (active|paused|suspended|cancelled)
- `owner_id` - Foreign key to users
- `metadata` & `settings` - JSONB for extensibility
- `created_at`, `updated_at`, `deleted_at` - Audit timestamps

**Indexes:**
- `slug` (unique, soft-delete aware)
- `owner_id`, `status`, `plan` (filtering)
- `created_at` (time-based queries)
- Composite `(status, plan)` for common queries

### 3. **users Table**
Individual users within a company. Key features:
- `id` - UUID primary key
- `company_id` - Foreign key (NOT NULL, ON DELETE CASCADE)
- `email` - User email address
- `role` - user_role enum (owner|admin|member|viewer)
- `auth_id` - Reference to external auth service (Supabase, Auth0, etc.)
- `status` - active|inactive|invited|suspended
- `email_verified` & `email_verified_at` - Email verification tracking
- `last_login_at`, `last_activity_at` - Activity tracking
- `preferences`, `metadata` - JSONB extensibility
- `created_at`, `updated_at`, `deleted_at` - Audit timestamps

**Unique Constraints:**
- `(company_id, email)` - Same email cannot exist in same company
- `auth_id` - External auth ID must be unique system-wide

**Indexes:**
- `email`, `(company_id, email)` - Auth lookups
- `(company_id, role)` - Role-based access queries
- `status`, `last_activity_at` - Filtering & activity reports
- `auth_id` - External auth provider lookups

### 4. **company_members Junction Table**
Alternative/supplementary table for managing team structures:
- Useful for: multiple roles per user, membership states, invitations
- Tracks: user, company, role, joined_at, invited_by, invite_accepted_at

### 5. **audit_logs Table**
Security and compliance audit trail:
- Tracks all changes with: user, action, entity, old/new values, IP, user agent
- Essential for: security, compliance, debugging, regulatory requirements

### 6. **Helper Functions**

| Function | Purpose |
|----------|---------|
| `update_updated_at_column()` | Trigger to auto-update `updated_at` timestamps |
| `get_user_companies()` | Get all companies a user belongs to with roles |
| `user_has_company_role()` | Check if user has specific role (hierarchy-aware) |
| `get_company_users()` | Get all users in a company |
| `create_audit_log()` | Create audit entries for compliance tracking |

## Execution Instructions

### Prerequisites
- PostgreSQL 11+ (for JSON support and triggers)
- Required extensions: none (uses built-in functions)
- Permissions: Schema owner or admin role

### Run the Migration

```bash
# Using psql directly
psql -U postgres -d your_database -f src/lib/auth/001_create_companies_users_roles.sql

# Using Supabase CLI
supabase db push

# Using migration framework (e.g., Flyway, Liquibase)
# Just point to the SQL file
```

### Verify Success

```sql
-- Check enum type
SELECT * FROM pg_type WHERE typname = 'user_role';

-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('companies', 'users', 'company_members', 'audit_logs');

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename IN ('companies', 'users');

-- Check functions
SELECT proname FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND (proname LIKE '%user%' OR proname LIKE '%company%');
```

## Schema Diagram

```
┌─────────────────┐
│   companies     │
├─────────────────┤
│ id (PK)         │
│ name            │
│ slug (UNIQUE)   │
│ plan            │
│ status          │
│ owner_id (FK)──┐
│ metadata        │ 1
│ created_at      │ │
└─────────────────┘ │
                    │
                    │
                ┌───┴──────────────┐
                │    users         │
                ├──────────────────┤
                │ id (PK)          │
                │ company_id (FK)──┤
                │ email            │
                │ role (ENUM)      │
                │ auth_id (UNIQUE) │
                │ status           │
                │ last_login_at    │
                │ metadata         │
                │ created_at       │
                └──────────────────┘
                    1  │
                       │ *
                ┌───────┴─────────────┐
                │  company_members    │
                ├─────────────────────┤
                │ user_id (FK)        │
                │ company_id (FK)     │
                │ role (ENUM)         │
                │ joined_at           │
                │ invited_by (FK)     │
                └─────────────────────┘

┌──────────────────┐
│  audit_logs      │
├──────────────────┤
│ id (PK)          │
│ company_id (FK)  │
│ user_id (FK)     │
│ action           │
│ entity_type      │
│ entity_id        │
│ old_values       │
│ new_values       │
│ created_at       │
└──────────────────┘
```

## Key Features & Best Practices

### Multi-Tenancy Design
- **Company isolation**: Every user belongs to exactly one company
- **Row-level security ready**: Foundation for PostgreSQL RLS policies
- **Soft deletes**: `deleted_at` columns for data recovery

### Performance Optimizations
- **Strategic indexes**: On foreign keys, filtering columns, and query patterns
- **Composite indexes**: For common multi-column queries like `(company_id, email)`
- **Filtered indexes**: Soft-delete aware indexes exclude deleted rows

### Data Integrity
- **Foreign key constraints**: ON DELETE CASCADE for companies → users
- **Unique constraints**: Email per company, auth_id system-wide
- **Enum type**: Type-safe role values
- **JSONB fields**: Extensible without schema migrations

### Audit & Compliance
- **Timestamps**: created_at, updated_at (auto), deleted_at for soft deletes
- **Audit logs table**: Track all changes with user, IP, and user agent
- **Trigger functions**: Automatic updated_at updates

### Extensibility
- **metadata JSONB**: Store custom data without schema changes
- **preferences JSONB**: User settings, feature flags, UI preferences
- **settings JSONB**: Company-level configuration

## Role Hierarchy

When checking permissions, roles follow this hierarchy:
```
owner  > admin  > member  > viewer
 ↓       ↓        ↓         ↓
Full   Admin  Standard  Read-only
access access access    access
```

Use `user_has_company_role()` function to check permissions:
```sql
-- Check if user has admin or higher
SELECT user_has_company_role(user_id, company_id, 'admin'::user_role);
```

## Sample Data Insertion

```sql
-- Insert a company
INSERT INTO companies (name, slug, owner_id)
VALUES (
  'Acme Corp',
  'acme-corp',
  '550e8400-e29b-41d4-a716-446655440000'::UUID
);

-- Insert a user in that company
INSERT INTO users (company_id, email, full_name, role, auth_id)
VALUES (
  (SELECT id FROM companies WHERE slug = 'acme-corp'),
  'john@acme.com',
  'John Doe',
  'member'::user_role,
  '660e8400-e29b-41d4-a716-446655440111'::UUID
);

-- Create audit log
SELECT create_audit_log(
  company_id := (SELECT id FROM companies WHERE slug = 'acme-corp'),
  p_user_id := '550e8400-e29b-41d4-a716-446655440000'::UUID,
  p_action := 'user_created',
  p_entity_type := 'users',
  p_entity_id := (SELECT id FROM users WHERE email = 'john@acme.com'),
  p_ip_address := '192.168.1.1'
);
```

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Drop tables (in reverse order of creation)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS company_members CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS create_audit_log CASCADE;
DROP FUNCTION IF EXISTS get_company_users CASCADE;
DROP FUNCTION IF EXISTS user_has_company_role CASCADE;
DROP FUNCTION IF EXISTS get_user_companies CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Drop enum type
DROP TYPE IF EXISTS user_role CASCADE;
```

## Next Steps

After running this migration:

1. **Create Row-Level Security (RLS) policies** for fine-grained access control
2. **Set up external authentication** (Supabase, Auth0, etc.) and populate `auth_id`
3. **Create application layer** functions for user signup, company creation, invitations
4. **Add triggers** for email verification, account activation workflows
5. **Set up backup/recovery** procedures for the audit_logs table
6. **Configure monitoring** on audit_logs for suspicious activity

## Support & Troubleshooting

**Issue: "user_role type already exists"**
```sql
-- Check if type exists
SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'user_role');

-- Drop and recreate if needed
DROP TYPE IF EXISTS user_role CASCADE;
```

**Issue: Foreign key constraint violation**
- Ensure `owner_id` in companies table references a valid user_id
- Run migration for users table before inserting company data

**Issue: Index creation slow on large tables**
- Add `CONCURRENTLY` to index creation (requires closing other transactions)
- Run index creation during maintenance windows

---

**Created:** 2026-08-13  
**For:** IAeZap Multi-Tenant System  
**Status:** Production Ready
