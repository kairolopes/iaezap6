# Multi-Tenant Company Migration Plan

**Status**: Ready for Execution  
**Version**: 1.0  
**Date**: 2026-08-13  
**Owner**: Kairo Lopes (kairo@zapbaratinho.com.br)

---

## Executive Summary

This document outlines a safe, reversible migration strategy to add **company-level multi-tenancy** to the IAeZap system. The migration preserves all existing data in conversations, messages, and message_rules tables while establishing a new company infrastructure layer.

### Key Constraints (PRESERVED)
- ✅ Existing `conversations` table structure unchanged
- ✅ Existing `messages` table structure unchanged  
- ✅ Existing `message_rules` table structure unchanged
- ✅ All existing data remains intact
- ✅ Each step is independently reversible

### What Changes
- ➕ New tables: `companies`, `company_members`, `company_tenants`, `company_settings`
- ➕ New columns: `company_id` (nullable) on `z_api_instances`, `message_rules`, `audit_logs`, `conversations`
- ➕ New helper functions for company operations
- ➕ Master user account for system administration

---

## Architecture Overview

### Current State (Tenant-Level)
```
┌─────────────────────────────────────────┐
│         User (auth.users)               │
└──────────────────┬──────────────────────┘
                   │
                   ├─→ users_tenants (role-based)
                   │
                   └─→ Tenant
                        ├─→ Conversations
                        │   └─→ Messages
                        └─→ Message Rules
```

### Target State (Company + Tenant)
```
┌──────────────────────────────────────────┐
│         User (auth.users)                │
└──────────────┬──────────────────────────┘
               │
               ├─→ company_members (role-based)
               │
               └─→ Company (New!)
                    ├─→ company_tenants (mapping)
                    │   ├─→ Tenant (existing)
                    │   │   ├─→ Conversations
                    │   │   │   └─→ Messages
                    │   │   └─→ Message Rules
                    │   └─→ API Instances
                    └─→ Company Settings
```

---

## Migration Phases

### PHASE 1: Create Company Infrastructure (Zero Downtime)

**Step 1.1**: Create `companies` table
- Root entity for organization level
- Fields: id, name, slug, plan, status, owner_id, metadata
- Indexes on: slug, owner_id, status, plan

**Step 1.2**: Create `company_members` table
- User membership in companies
- Fields: user_id, company_id, role (owner/admin/member/viewer), joined_at
- Composite PK: (user_id, company_id)
- Indexes on: user_id, company_id, role

**Step 1.3**: Create `company_tenants` table
- Maps companies to workspaces/tenants
- Fields: company_id, tenant_id (FK to tenants)
- Allows 1 company → N tenants
- Composite PK: (company_id, tenant_id)

**Step 1.4**: Create `company_settings` table
- Stores company-level configuration
- Fields: company_id (PK), api_key_prefix, webhook_url, timezone, etc.
- Linked to companies via FK

**Why Zero Downtime**
- No changes to existing tables
- No data migration
- No schema alterations
- Read-only operations unaffected

**Rollback**: DELETE from new tables in reverse order

---

### PHASE 2: Add company_id Column to Existing Tables (Low Risk)

**Step 2.1**: Add nullable `company_id` column to tables
- `z_api_instances` - track which company owns each API instance
- `message_rules` - track which company each automation belongs to
- `audit_logs` - track audit events at company level
- `conversations` - optional, for company-wide analytics

**Design Decision: NULLABLE COLUMNS**
```
BEFORE: 
z_api_instances { id, instance_id, tenant_id }

AFTER:
z_api_instances { id, instance_id, tenant_id, company_id (NULL) }
                                           ^^^^^^^ Initially null
```

**Why Nullable**
- Existing records can stay unchanged during backfill
- No data migration required initially
- Gradual rollout possible
- Can identify unmigrated records easily

**Step 2.2**: Create indexes on new columns
- Improves query performance
- Especially important for `z_api_instances` lookups

**Rollback**: DROP columns with CASCADE

---

### PHASE 3: Create Master User Account

**Step 3.1**: Create system admin user
- Email: `kairo@zapbaratinho.com.br` (or designated admin)
- Role: Super admin across all companies
- Created via Supabase Auth Dashboard (not SQL)

**Step 3.2**: Record master user UUID
- Get UUID from `auth.users` table after creation
- Use in company creation as `owner_id`

**Temporary Strategy**
- Use placeholder UUID: `00000000-0000-0000-0000-000000000000`
- Replace with actual UUID after user creation in Supabase

**Rollback**: Delete company_members entries for master user

---

### PHASE 4: Backfill company_id (Data Migration)

**Step 4.1**: Create companies from existing tenants
```sql
INSERT INTO companies (name, slug, owner_id, metadata)
SELECT
  t.name,
  t.slug,
  <master_user_uuid>,
  jsonb_build_object('migrated_from_tenant', t.id)
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE ...);
```

**Strategy: 1 Tenant → 1 Company (MVP)**
- Each existing tenant becomes a company
- Initial company plan: 'starter'
- Metadata tracks migration source

**Step 4.2**: Create company_tenants mappings
```sql
INSERT INTO company_tenants (company_id, tenant_id)
SELECT c.id, (c.metadata->>'migrated_from_tenant')::UUID
FROM companies c;
```

**Step 4.3**: Backfill company_id in dependent tables
```sql
UPDATE z_api_instances zai
SET company_id = c.id
FROM companies c
WHERE zai.tenant_id::UUID = (c.metadata->>'migrated_from_tenant')::UUID;
```

**Data Integrity Checks**
- All instances have company_id after update
- No conversations/messages modified
- All message_rules linked to company

**Rollback**: UPDATE x SET company_id = NULL WHERE company_id IS NOT NULL

---

### PHASE 5: Add Helper Functions (Application Ready)

**Step 5.1**: Helper functions for common operations
```
get_user_companies(user_id)           → List user's companies
user_has_company_role(user_id, company_id, role) → Check permission
get_company_tenants(company_id)       → List company's tenants
```

**Used By Application Layer**
- Authorization checks
- Company/tenant filtering
- User onboarding flows

**Rollback**: DROP FUNCTIONs

---

### PHASE 6: Add Triggers for Auto-Timestamps

**Step 6.1**: Auto-update `updated_at` on modification
- Trigger on `companies` table updates
- Trigger on `company_settings` updates

**Rollback**: DROP TRIGGERs

---

### PHASE 7: Verification Phase (Before Constraints)

**Run Verification Queries** (see section below)

Verify:
- ✅ All new tables created
- ✅ All columns added correctly
- ✅ All companies created from tenants
- ✅ All mappings correct
- ✅ company_id values backfilled
- ✅ No data loss in existing tables
- ✅ Index creation successful

**Only proceed to Phase 8 if ALL checks pass**

---

### PHASE 8: Add NOT NULL Constraints (Optional, After Verification)

**Step 8.1**: Make company_id NOT NULL (if 100% backfilled)
```sql
ALTER TABLE z_api_instances
ALTER COLUMN company_id SET NOT NULL;
```

**Only If**
- All z_api_instances have company_id = some value
- No orphaned records remain
- Verification phase passed 100%

**Rollback**: ALTER COLUMN company_id DROP NOT NULL

**⚠️ OPTIONAL**: Can skip this phase and keep columns nullable indefinitely. Less strict but safer.

---

## Execution Steps

### Pre-Migration Checklist

- [ ] Full database backup created
- [ ] Backup stored in secure location
- [ ] Team notified of migration window (if applicable)
- [ ] Z-API webhook processing paused (optional, if offline)
- [ ] Supabase dashboard open for monitoring

### Step-by-Step Execution

#### 1. Execute Phase 1 SQL (Create Infrastructure)
```bash
# Open: docs/MIGRATION_MULTITENANT_COMPANY.sql
# Scroll to: PHASE 1 section
# Select: Lines for 1.1 through 1.8
# Run in Supabase SQL Editor
# Wait: ~5-10 seconds for tables to create
# Verify: No error messages
```

**Expected Output**
```
CREATE TABLE (or CREATE TABLE ... IF NOT EXISTS)
CREATE INDEX
[repeats for each table/index]
```

#### 2. Execute Phase 2 SQL (Add Columns)
```bash
# Select: PHASE 2 section (3.1 through 3.8)
# Run in Supabase SQL Editor
# Wait: ~10-15 seconds
# Verify: All ALTER TABLE commands succeeded
```

**Expected Output**
```
ALTER TABLE
CREATE INDEX
[repeats for each column addition]
```

#### 3. Create Master User in Supabase Auth
```bash
# Go to: Supabase Dashboard → Authentication → Users
# Click: "Invite" or create new user
# Email: kairo@zapbaratinho.com.br
# Password: [Strong password]
# Note: Copy the generated UUID
```

#### 4. Update Master User UUID
```sql
-- Find the actual UUID from auth.users
SELECT id, email FROM auth.users WHERE email = 'kairo@zapbaratinho.com.br';
-- Copy the UUID returned
```

#### 5. Execute Phase 3-4 SQL (Functions + Migration)
```bash
# Select: PHASE 4 section
# IMPORTANT: Replace '00000000-0000-0000-0000-000000000000' with actual master user UUID
# Find and Replace: 00000000-0000-0000-0000-000000000000 → <actual_uuid>
# Run in Supabase SQL Editor
# Wait: ~20-30 seconds (backfill takes longer)
```

**Expected Output for Migration**
```
CREATE OR REPLACE FUNCTION migrate_tenants_to_companies()

-- Then test the function:
SELECT * FROM migrate_tenants_to_companies();

Expected result:
created_companies | created_mappings | updated_instances | status
       3          |       3          |       5           | SUCCESS
```

#### 6. Run Verification Queries (Phase 8)
```bash
# Select: PHASE 8 section
# Run each verification query
# Document results
# Compare before/after (should be same for existing tables)
```

#### 7. Execute Phase 6 SQL (Triggers)
```bash
# Select: PHASE 6 section
# Run in Supabase SQL Editor
# Should complete instantly
```

---

## Verification Queries

### Query Set 1: Schema Verification

**Check New Tables Exist**
```sql
SELECT 'companies' as table_name, COUNT(*) as row_count FROM companies
UNION ALL
SELECT 'company_members', COUNT(*) FROM company_members
UNION ALL
SELECT 'company_tenants', COUNT(*) FROM company_tenants
UNION ALL
SELECT 'company_settings', COUNT(*) FROM company_settings;
```

**Expected Result** (after Phase 4)
```
table_name        | row_count
companies         | 3         (1 per tenant)
company_members   | 3         (master user in each company)
company_tenants   | 3         (1:1 mapping to tenants)
company_settings  | 0         (created empty, populated later)
```

---

### Query Set 2: Column Verification

**Check company_id Columns Added**
```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN (
  'z_api_instances',
  'message_rules',
  'audit_logs',
  'conversations'
)
AND column_name = 'company_id'
ORDER BY table_name;
```

**Expected Result** (after Phase 2)
```
table_name         | column_name | data_type | is_nullable
z_api_instances    | company_id  | uuid      | YES
message_rules      | company_id  | uuid      | YES
audit_logs         | company_id  | uuid      | YES
conversations      | company_id  | uuid      | YES
```

---

### Query Set 3: Backfill Verification

**Check company_id Backfill Progress**
```sql
SELECT
  'z_api_instances' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as has_company_id,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id
FROM z_api_instances
UNION ALL
SELECT
  'message_rules',
  COUNT(*),
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END),
  COUNT(CASE WHEN company_id IS NULL THEN 1 END)
FROM message_rules;
```

**Expected Result** (after Phase 4)
```
table_name      | total_records | has_company_id | null_company_id
z_api_instances | 5             | 5              | 0        ← All backfilled
message_rules   | 12            | 12             | 0        ← All backfilled
```

---

### Query Set 4: Data Integrity Check

**Verify No Data Loss in Protected Tables**
```sql
-- Before (run BEFORE migration)
SELECT 
  'conversations' as entity,
  COUNT(*) as total_records
FROM conversations;

-- After (run AFTER Phase 4)
SELECT 
  'conversations' as entity,
  COUNT(*) as total_records
FROM conversations;
-- Should be SAME number

-- Same for messages
SELECT COUNT(*) as message_count FROM messages;
-- Should be SAME as before
```

**Expected Result** (Should match pre-migration)
```
conversations: [original_count] (UNCHANGED)
messages:      [original_count] (UNCHANGED)
message_rules: [original_count] (UNCHANGED)
```

---

### Query Set 5: Company-Tenant Mapping

**Verify Correct Mapping**
```sql
SELECT
  c.id as company_id,
  c.name as company_name,
  c.plan,
  t.id as tenant_id,
  t.name as tenant_name,
  COUNT(DISTINCT zai.id) as instance_count
FROM companies c
LEFT JOIN company_tenants ct ON ct.company_id = c.id
LEFT JOIN tenants t ON t.id = ct.tenant_id
LEFT JOIN z_api_instances zai ON zai.company_id = c.id
GROUP BY c.id, c.name, c.plan, t.id, t.name
ORDER BY c.created_at DESC;
```

**Expected Result** (after Phase 4)
```
company_id | company_name | plan | tenant_id | tenant_name | instance_count
-----------+--------------+------+-----------+-------------+----------------
uuid-1     | Tenant 1     | starter | uuid-1 | Tenant 1   | 2
uuid-2     | Tenant 2     | starter | uuid-2 | Tenant 2   | 1
uuid-3     | Tenant 3     | starter | uuid-3 | Tenant 3   | 2
```

---

## Rollback Strategy

### Emergency Rollback (If Issues Detected)

**Do NOT use the rollback procedures unless critical issues found**

In reverse order of phases:

#### Rollback Phase 8 (Constraints)
```sql
ALTER TABLE z_api_instances
ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE message_rules
ALTER COLUMN company_id DROP NOT NULL;
```

#### Rollback Phase 4 (Data)
```sql
-- Clear backfilled data
UPDATE z_api_instances SET company_id = NULL;
UPDATE message_rules SET company_id = NULL;
UPDATE audit_logs SET company_id = NULL;
UPDATE conversations SET company_id = NULL;

-- Clear migration data
DELETE FROM company_settings;
DELETE FROM company_tenants;
DELETE FROM company_members;
DELETE FROM companies;
```

#### Rollback Phase 2-3 (Columns)
```sql
ALTER TABLE z_api_instances DROP COLUMN company_id CASCADE;
ALTER TABLE message_rules DROP COLUMN company_id CASCADE;
ALTER TABLE audit_logs DROP COLUMN company_id CASCADE;
ALTER TABLE conversations DROP COLUMN company_id CASCADE;
```

#### Rollback Phase 1 (Tables)
```sql
DROP TABLE company_settings CASCADE;
DROP TABLE company_tenants CASCADE;
DROP TABLE company_members CASCADE;
DROP TABLE companies CASCADE;
```

#### Rollback Phase 6 (Functions)
```sql
DROP FUNCTION IF EXISTS migrate_tenants_to_companies() CASCADE;
DROP FUNCTION IF EXISTS ensure_master_user() CASCADE;
DROP FUNCTION IF EXISTS get_user_companies(UUID) CASCADE;
DROP FUNCTION IF EXISTS user_has_company_role(UUID, UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS get_company_tenants(UUID) CASCADE;
```

---

## Application Integration

### After Migration: Update Application Code

#### 1. Company Context Middleware
```typescript
// middleware.ts - Add company_id to request context
const getCompanyContext = async (userId: string, requestPath: string) => {
  // Check if URL contains company_id
  const companyId = extractFromUrl(requestPath);
  
  if (!companyId) {
    // Get user's default/first company
    const companies = await db.call('get_user_companies', userId);
    return companies[0]?.company_id;
  }
  
  // Verify user has access to this company
  const hasAccess = await db.call(
    'user_has_company_role',
    userId,
    companyId,
    'viewer'
  );
  
  return hasAccess ? companyId : null;
};
```

#### 2. API Route Updates
```typescript
// /api/conversations/route.ts - Filter by company
export async function GET(request: NextRequest) {
  const { companyId } = request.context;
  
  const conversations = await supabase
    .from('conversations')
    .select('*')
    .eq('company_id', companyId)  // Add company filter
    .order('created_at', { ascending: false });
  
  return NextResponse.json(conversations);
}
```

#### 3. Tenant Isolation Update
```typescript
// Replace single tenant_id with company_id-based isolation
// OLD:
conversations WHERE tenant_id = ${tenantId}

// NEW:
conversations WHERE company_id = ${companyId} AND tenant_id = ${tenantId}
```

---

## Monitoring & Support

### During Migration

**Monitor These Metrics**
- Database response times (check Supabase dashboard)
- Webhook processing latency (check logs)
- User queries timing (if running during business hours)
- Error rates (should remain 0 until Phase 4)

**Logs to Watch**
```
Supabase SQL Editor: "All commands executed successfully"
Application logs: No auth errors, no RLS denials
```

### Post-Migration

**First 24 Hours**
- Monitor application errors
- Verify webhook processing works
- Check company creation/deletion operations
- Test tenant switching (if multi-tenant UI)

**First Week**
- Verify all users can access their companies
- Check API performance with new company_id filters
- Monitor billing/usage tracking (uses company_id)

---

## Risk Assessment

### Low Risk (Phase 1-3)
- ✅ Read-only operations unaffected
- ✅ No downtime required
- ✅ Easy rollback available
- ✅ No data migration initially

### Medium Risk (Phase 4)
- ⚠️ Data backfill operation
- ⚠️ Requires careful verification
- ⚠️ Large UPDATE statements
- ✅ Non-destructive (only updating NULL→UUID)

### Mitigation Strategies
1. **Full Backup Before Phase 4** - Restore if needed
2. **Run in Test Database First** - Verify on staging
3. **Verification Queries Between Phases** - Stop if issues found
4. **Gradual Rollout** - Deploy to few users first
5. **Team Standby** - Have team available during migration

---

## Success Criteria

Migration is successful when:

1. ✅ All new tables created without errors
2. ✅ All company_id columns added to existing tables
3. ✅ All existing data in conversations/messages/message_rules unchanged
4. ✅ All companies created from existing tenants
5. ✅ All company_tenants mappings created
6. ✅ All z_api_instances linked to companies
7. ✅ Helper functions work correctly
8. ✅ Verification queries show expected results
9. ✅ No error messages in Supabase logs
10. ✅ Application can read from new company structure

---

## Timeline

**Estimated Duration: 1-2 hours**

| Phase | Duration | Status |
|-------|----------|--------|
| 1. Create infrastructure | 5-10 min | Ready |
| 2. Add columns | 10-15 min | Ready |
| 3. Create master user | 5 min | Ready |
| 4. Backfill data | 20-30 min | Ready |
| 5. Create functions | 10 min | Ready |
| 6. Add triggers | 2 min | Ready |
| 7. Verification | 15-20 min | Ready |
| 8. Add constraints | 5 min | Optional |
| **Total** | **~60-90 min** | **Ready to Execute** |

---

## Contact & Support

**For Questions or Issues During Migration**
- Contact: Kairo Lopes (kairo@zapbaratinho.com.br)
- Reference this document: `/docs/MIGRATION_PLAN.md`
- SQL script: `/docs/MIGRATION_MULTITENANT_COMPANY.sql`

---

## Appendix: SQL Reference

### Quick Reference for Supabase SQL Editor

**Copy & Paste These Sections in Order**

1. [Copy PHASE 1 section]
2. [Copy PHASE 2 section]
3. [Copy PHASE 3-4 section] ← Replace master_user_uuid first!
4. [Copy PHASE 6 section]
5. [Run verification queries from PHASE 8]

---

**Migration Plan End**
