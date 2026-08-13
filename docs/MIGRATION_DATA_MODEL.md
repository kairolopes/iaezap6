# Multi-Tenant Company Data Model

**Version**: 1.0  
**Date**: 2026-08-13  
**Scope**: New company-level infrastructure for IAeZap

---

## Current Schema (Pre-Migration)

```
tenants (workspace/account level)
├── id (PK)
├── name
├── slug (UNIQUE)
├── created_at
└── updated_at

users_tenants (user ↔ tenant mapping)
├── user_id (FK → auth.users)
├── tenant_id (FK → tenants)
├── role (admin, member, viewer)
└── created_at

conversations (tenant-scoped)
├── id (PK)
├── tenant_id (FK)
├── phone_number
├── contact_name
├── started_at
├── status
├── created_at
└── updated_at

messages (tenant-scoped via conversation)
├── id (PK)
├── conversation_id (FK)
├── direction (inbound, outbound)
├── content
├── timestamp
├── provider_id
├── created_at
└── updated_at

message_rules (tenant-scoped automation)
├── id (PK)
├── tenant_id (FK)
├── rule_name
├── conditions (JSONB)
├── response_template
├── active
├── created_at
└── updated_at

z_api_instances (Z-API integration)
├── id (PK)
├── instance_id
├── tenant_id (FK)
├── api_key
├── created_at
└── updated_at
```

---

## New Schema (Post-Migration)

### NEW: Company Infrastructure

#### companies
```
companies (NEW - organization level)
├── id (PK, UUID)
├── name (VARCHAR 255)
├── slug (VARCHAR 100, UNIQUE)
├── plan ('starter'|'professional'|'enterprise')
├── status ('active'|'paused'|'cancelled')
├── owner_id (FK → auth.users)
├── metadata (JSONB)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

Indexes:
├── idx_companies_slug
├── idx_companies_owner_id
├── idx_companies_status
├── idx_companies_plan
└── idx_companies_created_at
```

#### company_members
```
company_members (NEW - user ↔ company mapping)
├── user_id (FK → auth.users)
├── company_id (FK → companies, CASCADE DELETE)
├── role ('owner'|'admin'|'member'|'viewer')
├── joined_at (TIMESTAMP)
└── PK: (user_id, company_id)

Indexes:
├── idx_company_members_user_id
├── idx_company_members_company_id
├── idx_company_members_role
└── idx_company_members_joined_at

Hierarchy:
owner > admin > member > viewer
```

#### company_tenants
```
company_tenants (NEW - company ↔ tenant mapping)
├── company_id (FK → companies, CASCADE DELETE)
├── tenant_id (FK → tenants, CASCADE Delete)
├── created_at (TIMESTAMP)
└── PK: (company_id, tenant_id)

Indexes:
├── idx_company_tenants_company_id
└── idx_company_tenants_tenant_id

Cardinality:
1 company : N tenants
(1:N relationship - one company can own multiple tenants)
```

#### company_settings
```
company_settings (NEW - company-level configuration)
├── company_id (PK, FK → companies, CASCADE Delete)
├── api_key_prefix (VARCHAR 50)
├── webhook_url (TEXT)
├── timezone (VARCHAR 50, default 'UTC')
├── notification_email (VARCHAR 255)
├── advanced_settings (JSONB)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

Index:
└── idx_company_settings_company_id
```

---

### MODIFIED: Existing Tables with company_id

#### z_api_instances
```
z_api_instances (MODIFIED - add company_id)
├── id (PK)
├── instance_id
├── tenant_id (FK → tenants)
├── company_id (NEW - FK → companies, SET NULL, NULLABLE)
├── api_key
├── created_at
└── updated_at

New Index:
└── idx_z_api_instances_company_id

Schema Change:
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
```

#### message_rules
```
message_rules (MODIFIED - add company_id)
├── id (PK)
├── tenant_id (FK → tenants)
├── company_id (NEW - FK → companies, SET NULL, NULLABLE)
├── rule_name
├── conditions (JSONB)
├── response_template
├── active
├── created_at
└── updated_at

New Index:
└── idx_message_rules_company_id

Schema Change:
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
```

#### audit_logs
```
audit_logs (MODIFIED - add company_id)
├── id (PK)
├── tenant_id (FK → tenants)
├── company_id (NEW - FK → companies, SET NULL, NULLABLE)
├── action
├── entity
├── entity_id
├── user_id
├── changes (JSONB)
├── ip_address
├── user_agent
├── timestamp
└── created_at

New Index:
└── idx_audit_logs_company_id

Schema Change:
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
```

#### conversations
```
conversations (MODIFIED - add company_id for analytics)
├── id (PK)
├── tenant_id (FK → tenants)
├── company_id (NEW - FK → companies, SET NULL, NULLABLE)
├── phone_number
├── contact_name
├── started_at
├── status
├── created_at
└── updated_at

New Index:
└── idx_conversations_company_id

Schema Change:
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

Note: This is optional, mainly for company-level analytics
```

---

## UNCHANGED Tables

### (No changes - preserved entirely)

- ✅ **messages** - No changes (tenant-scoped via conversation)
- ✅ **tenants** - No changes (structure preserved)
- ✅ **users_tenants** - No changes
- ✅ **auth_metadata** - No changes
- ✅ **auth.users** - No changes
- ✅ Any other application tables

---

## Data Integrity Guarantees

### Migration Strategy: Backward Compatibility

**Principle**: New company_id columns are **NULLABLE**

```
Before Migration:
z_api_instances.company_id = NULL

After Phase 4 (backfill):
z_api_instances.company_id = <UUID of company> (for all records)
```

**Advantage**:
- Existing queries still work without company_id
- Gradual adoption in application layer
- Easy rollback if issues found
- No forced constraint violations

### Option: Make Columns NOT NULL (Phase 9)

After 100% verification, can make columns NOT NULL:

```sql
ALTER TABLE z_api_instances
ALTER COLUMN company_id SET NOT NULL;
```

**Only after confirming**:
- All instances have company_id value
- No NULL values remain
- Backfill completed successfully

---

## Query Examples

### Post-Migration Data Access Patterns

#### Get all conversations for a company
```sql
SELECT * FROM conversations
WHERE company_id = '...' AND status = 'active'
ORDER BY started_at DESC;
```

#### Get all Z-API instances for a company
```sql
SELECT * FROM z_api_instances
WHERE company_id = '...'
ORDER BY created_at DESC;
```

#### Get all automation rules for a company
```sql
SELECT * FROM message_rules
WHERE company_id = '...' AND active = true
ORDER BY created_at DESC;
```

#### Get companies for a user
```sql
SELECT c.* FROM companies c
INNER JOIN company_members cm ON cm.company_id = c.id
WHERE cm.user_id = '<user_uuid>'
ORDER BY cm.joined_at DESC;
```

#### Check if user has access to company
```sql
SELECT * FROM company_members
WHERE user_id = '<user_uuid>'
AND company_id = '<company_uuid>';

-- Returns role if user is member, NULL otherwise
```

#### Get all tenants in a company
```sql
SELECT t.* FROM tenants t
INNER JOIN company_tenants ct ON ct.tenant_id = t.id
WHERE ct.company_id = '<company_uuid>'
ORDER BY t.created_at DESC;
```

---

## Relationships & Cardinality

### One-to-Many Relationships

```
companies (1) ──← company_members ──→ (many)
companies (1) ──← company_tenants ──→ (many) tenants
companies (1) ──← company_settings → (1)
companies (1) ──← message_rules ──→ (many)
companies (1) ──← z_api_instances ──→ (many)
companies (1) ──← audit_logs ──→ (many)
companies (1) ──← conversations ──→ (many) [optional, for analytics]
```

### Many-to-Many Relationships (via junction tables)

```
users (many) ──← company_members ──→ (many) companies
users (many) ──← users_tenants ──→ (many) tenants
companies (many) ──← company_tenants ──→ (many) tenants
```

### Hierarchy

```
User
 ├─→ company_members (define company role)
 │    └─→ Company
 │         ├─→ company_tenants (define workspace mapping)
 │         │    └─→ Tenant
 │         │         ├─→ Conversations
 │         │         │   └─→ Messages
 │         │         └─→ Message Rules
 │         ├─→ Z-API Instances
 │         └─→ Audit Logs
 └─→ users_tenants (define tenant role) [still exists, separate tree]
      └─→ Tenant [same tenants as above]
```

---

## Access Control Model

### Role-Based Access Control (RBAC)

#### Company Level Roles
```
owner  → Full company control, can delete company
admin  → Manage members, tenants, settings
member → Use company features, create resources
viewer → Read-only access to company resources
```

#### Tenant Level Roles (unchanged)
```
admin  → Full tenant control (unchanged)
member → Standard tenant user (unchanged)
viewer → Read-only (unchanged)
```

### Dual Authorization

To access a resource, user must have:
1. **Company-level permission** (via company_members)
2. **Tenant-level permission** (via users_tenants)

Example: View conversations
```
User wants to view Conversation C
  ├─ Check: Is user in Conversation.Company as viewer+?
  │   └─ SELECT FROM company_members WHERE user_id = ? AND company_id = ?
  │
  └─ Check: Is user in Conversation.Tenant as viewer+?
      └─ SELECT FROM users_tenants WHERE user_id = ? AND tenant_id = ?

Only allow access if BOTH checks pass
```

---

## Migration Data Flow

### Before Migration
```
Tenant "Acme Corp"
├─ Conversations: 150
├─ Messages: 5000
├─ Message Rules: 8
└─ Z-API Instances: 2
```

### During Migration (Phase 4)

```sql
-- 1. Create Company
INSERT INTO companies (name, slug, owner_id, ...)
VALUES ('Acme Corp', 'acme-corp', '<master_user_uuid>', ...);
-- Result: company_id = 'uuid-1'

-- 2. Map to Tenant
INSERT INTO company_tenants (company_id, tenant_id)
VALUES ('uuid-1', '<tenant_uuid>');

-- 3. Backfill company_id
UPDATE z_api_instances
SET company_id = 'uuid-1'
WHERE tenant_id = '<tenant_uuid>';

UPDATE message_rules
SET company_id = 'uuid-1'
WHERE tenant_id = '<tenant_uuid>';
```

### After Migration
```
Company "Acme Corp" (NEW)
├─ Company Settings
├─ Company Members: [master_user as owner]
├─ Tenant Mappings: [Acme Corp tenant]
│  └─ Tenant "Acme Corp"
│     ├─ Conversations: 150 (unchanged)
│     ├─ Messages: 5000 (unchanged)
│     ├─ Message Rules: 8 (now also linked to company)
│     └─ Z-API Instances: 2 (now also linked to company)
└─ Z-API Instances: 2 (direct link)
```

---

## Backup & Restore Considerations

### What's Backed Up
- ✅ All new tables (companies, company_members, etc.)
- ✅ All new columns (company_id on existing tables)
- ✅ All original data (unchanged)

### Restore Strategy
1. If critical issue detected mid-migration:
   - Restore from pre-migration backup
   - Drop all new tables/columns
   - Start over (if needed)

2. If issue detected post-migration:
   - Restore from post-migration backup
   - Use rollback procedures (see MIGRATION_PLAN.md)

### Backup Points
- [ ] **Pre-Migration**: Full backup before Phase 1
- [ ] **Mid-Migration**: After Phase 4 (data loaded), before Phase 8
- [ ] **Post-Migration**: Final state after all phases

---

## Future Extensions

### Planned (Not in this migration)
- [ ] Company payment plans (usage tiers)
- [ ] Company billing/invoicing system
- [ ] Company API keys for authentication
- [ ] Company webhooks and integrations
- [ ] Company audit log reporting/export
- [ ] Company team invitations workflow

### Out of Scope (This Migration)
- No changes to authentication system
- No changes to WhatsApp message handling
- No changes to rule automation engine
- No changes to conversation UI/UX
- No RLS policies (kept simple for MVP)

---

## Testing Checklist for New Schema

### Schema Tests
- [ ] All new tables exist and are queryable
- [ ] All new columns exist on existing tables
- [ ] All foreign keys work correctly
- [ ] All indexes are created
- [ ] No duplicate data in junction tables

### Data Integrity Tests
- [ ] Original conversation count unchanged
- [ ] Original message count unchanged
- [ ] Original message_rules count unchanged
- [ ] All z_api_instances have company_id value
- [ ] company_tenants has correct mappings

### Functional Tests
- [ ] get_user_companies() returns correct results
- [ ] user_has_company_role() works correctly
- [ ] get_company_tenants() returns correct tenants
- [ ] Updated_at timestamp trigger works
- [ ] Foreign key constraints enforced

### Application Tests
- [ ] Users can still access their data
- [ ] Webhooks still process correctly
- [ ] Message rules still execute
- [ ] No authentication issues
- [ ] No performance degradation

---

## Deployment Notes

### Pre-Deployment
- [ ] Test on staging environment first
- [ ] Have production backup ready
- [ ] Plan maintenance window (if needed)
- [ ] Notify users of any downtime

### Deployment
- [ ] Execute migration phases in order
- [ ] Run verification queries between phases
- [ ] Monitor logs for errors
- [ ] Keep team on standby

### Post-Deployment
- [ ] Update application code to filter by company_id
- [ ] Deploy updated application
- [ ] Monitor for 24+ hours
- [ ] Document any issues
- [ ] Update runbooks/documentation

---

## References

**Related Documents**
- `/docs/MIGRATION_MULTITENANT_COMPANY.sql` - SQL script
- `/docs/MIGRATION_PLAN.md` - Detailed migration plan
- `/docs/MIGRATION_CHECKLIST.md` - Step-by-step checklist
- `/docs/TASK_1_2_RLS_MIGRATIONS.sql` - Existing tenant schema

---

**Data Model Document End**
