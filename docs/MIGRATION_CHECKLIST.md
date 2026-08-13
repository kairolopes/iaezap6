# Multi-Tenant Migration - Execution Checklist

**Date**: _______________  
**Executor**: _______________  
**Environment**: [ ] Development [ ] Staging [ ] Production  

---

## Pre-Migration

- [ ] Database backup created and verified
- [ ] Backup location documented: _____________________
- [ ] Team notified of migration (if applicable)
- [ ] Read entire MIGRATION_PLAN.md
- [ ] Reviewed MIGRATION_MULTITENANT_COMPANY.sql
- [ ] Supabase dashboard tab open
- [ ] SQL Editor ready
- [ ] This checklist printed or displayed

---

## Phase 1: Create Infrastructure Tables

**File**: `docs/MIGRATION_MULTITENANT_COMPANY.sql`  
**Section**: PHASE 1: CREATE NEW COMPANY-LEVEL INFRASTRUCTURE TABLES

### Step 1.1 - Create `companies` table
- [ ] Copy lines for CREATE TABLE companies
- [ ] Run in SQL Editor
- [ ] Verify: No errors, table created

### Step 1.2 - Create indexes for companies
- [ ] Copy CREATE INDEX lines for companies table (4 indexes)
- [ ] Run in SQL Editor
- [ ] Verify: All 4 indexes created

### Step 1.3 - Create `company_members` table
- [ ] Copy CREATE TABLE company_members
- [ ] Run in SQL Editor
- [ ] Verify: No errors, table created

### Step 1.4 - Create indexes for company_members
- [ ] Copy CREATE INDEX lines for company_members (4 indexes)
- [ ] Run in SQL Editor
- [ ] Verify: All 4 indexes created

### Step 1.5 - Create `company_tenants` table
- [ ] Copy CREATE TABLE company_tenants
- [ ] Run in SQL Editor
- [ ] Verify: No errors, table created

### Step 1.6 - Create indexes for company_tenants
- [ ] Copy CREATE INDEX lines for company_tenants (2 indexes)
- [ ] Run in SQL Editor
- [ ] Verify: All 2 indexes created

### Step 1.7 - Create `company_settings` table
- [ ] Copy CREATE TABLE company_settings
- [ ] Run in SQL Editor
- [ ] Verify: No errors, table created

### Step 1.8 - Create index for company_settings
- [ ] Copy CREATE INDEX line for company_settings
- [ ] Run in SQL Editor
- [ ] Verify: Index created

**Phase 1 Summary**
- [ ] All 4 new tables created
- [ ] All 12 indexes created
- [ ] No error messages
- [ ] Ready for Phase 2

---

## Phase 2: Add company_id Columns to Existing Tables

**File**: `docs/MIGRATION_MULTITENANT_COMPANY.sql`  
**Section**: PHASE 3: ADD COMPANY_ID COLUMN TO EXISTING TABLES

### Step 2.1 - Add company_id to z_api_instances
- [ ] Copy ALTER TABLE z_api_instances ADD COLUMN
- [ ] Run in SQL Editor
- [ ] Verify: Column added, no errors

### Step 2.2 - Create index on z_api_instances.company_id
- [ ] Copy CREATE INDEX idx_z_api_instances_company_id
- [ ] Run in SQL Editor
- [ ] Verify: Index created

### Step 2.3 - Add company_id to message_rules
- [ ] Copy ALTER TABLE message_rules ADD COLUMN
- [ ] Run in SQL Editor
- [ ] Verify: Column added, no errors

### Step 2.4 - Create index on message_rules.company_id
- [ ] Copy CREATE INDEX idx_message_rules_company_id
- [ ] Run in SQL Editor
- [ ] Verify: Index created

### Step 2.5 - Add company_id to audit_logs
- [ ] Copy ALTER TABLE audit_logs ADD COLUMN
- [ ] Run in SQL Editor
- [ ] Verify: Column added, no errors

### Step 2.6 - Create index on audit_logs.company_id
- [ ] Copy CREATE INDEX idx_audit_logs_company_id
- [ ] Run in SQL Editor
- [ ] Verify: Index created

### Step 2.7 - Add company_id to conversations
- [ ] Copy ALTER TABLE conversations ADD COLUMN
- [ ] Run in SQL Editor
- [ ] Verify: Column added, no errors

### Step 2.8 - Create index on conversations.company_id
- [ ] Copy CREATE INDEX idx_conversations_company_id
- [ ] Run in SQL Editor
- [ ] Verify: Index created

**Phase 2 Summary**
- [ ] 4 columns added to existing tables
- [ ] 4 new indexes created
- [ ] No error messages
- [ ] Ready for Phase 3

---

## Phase 3: Create Master User

### Step 3.1 - Create user in Supabase Auth
- [ ] Go to Supabase Dashboard
- [ ] Navigate to: Authentication → Users
- [ ] Click: "Invite user" or "New user"
- [ ] Email: kairo@zapbaratinho.com.br
- [ ] Password: [Set strong password]
- [ ] Copy the generated UUID

### Step 3.2 - Record Master User UUID
- [ ] Master User UUID: `_________________________________________`
- [ ] Verified UUID exists in auth.users: [ ]

**Phase 3 Summary**
- [ ] Master user created in Supabase Auth
- [ ] UUID recorded for Phase 4
- [ ] Ready for Phase 4

---

## Phase 4: Run Migration Functions

**File**: `docs/MIGRATION_MULTITENANT_COMPANY.sql`  
**Section**: PHASE 4: CREATE MASTER USER + PHASE 5: BACKFILL COMPANY_ID

### Step 4.1 - Copy migration SQL
- [ ] Open `docs/MIGRATION_MULTITENANT_COMPANY.sql`
- [ ] Go to PHASE 4 section
- [ ] Find this line: `v_master_user UUID := '00000000-0000-0000-0000-000000000000'::UUID;`

### Step 4.2 - Replace placeholder with actual UUID
- [ ] Click: Find & Replace in text editor (Ctrl+H)
- [ ] Find: `00000000-0000-0000-0000-000000000000`
- [ ] Replace with: `[Your UUID from Phase 3.2]`
- [ ] Verify: Only 1 instance replaced

### Step 4.3 - Create migration function
- [ ] Copy entire PHASE 4 section (lines with CREATE OR REPLACE FUNCTION)
- [ ] Select and paste in SQL Editor
- [ ] Run in SQL Editor
- [ ] Verify: Function created, no errors

### Step 4.4 - Execute migration function
- [ ] Run this query in SQL Editor:
  ```sql
  SELECT * FROM migrate_tenants_to_companies();
  ```
- [ ] Wait: 20-30 seconds for completion
- [ ] Record Results:
  - Created Companies: _______
  - Created Mappings: _______
  - Updated Instances: _______
  - Status: _______

### Step 4.5 - Verify migration success
- [ ] Status = 'SUCCESS' (not ERROR)
- [ ] All numbers > 0
- [ ] No error messages
- [ ] Ready for Phase 5

**Phase 4 Summary**
- [ ] Migration function created
- [ ] Migration executed successfully
- [ ] All companies created from tenants
- [ ] All data backfilled
- [ ] Ready for Phase 5

---

## Phase 5: Create Helper Functions

**File**: `docs/MIGRATION_MULTITENANT_COMPANY.sql`  
**Section**: PHASE 7: CREATE HELPER FUNCTIONS FOR COMPANY OPERATIONS

### Step 5.1 - Copy helper functions
- [ ] Go to PHASE 7 section
- [ ] Copy entire section (CREATE OR REPLACE FUNCTION lines)

### Step 5.2 - Run helper functions in SQL Editor
- [ ] Paste in SQL Editor
- [ ] Run all functions at once
- [ ] Verify: All functions created without errors
- [ ] Expected: 3 function creation messages
  - [ ] get_user_companies
  - [ ] user_has_company_role
  - [ ] get_company_tenants

**Phase 5 Summary**
- [ ] All 3 helper functions created
- [ ] No error messages
- [ ] Functions tested in Phase 9
- [ ] Ready for Phase 6

---

## Phase 6: Add Triggers for Auto-Timestamps

**File**: `docs/MIGRATION_MULTITENANT_COMPANY.sql`  
**Section**: PHASE 6: ADD TRIGGERS FOR UPDATED_AT COLUMNS

### Step 6.1 - Copy update_updated_at_column function
- [ ] Copy CREATE OR REPLACE FUNCTION update_updated_at_column
- [ ] Run in SQL Editor
- [ ] Verify: Function created

### Step 6.2 - Copy and run triggers
- [ ] Copy: CREATE TRIGGER companies_update_updated_at
- [ ] Copy: CREATE TRIGGER company_settings_update_updated_at
- [ ] Run both in SQL Editor
- [ ] Verify: Both triggers created

**Phase 6 Summary**
- [ ] update_updated_at_column function created
- [ ] 2 triggers created (companies, company_settings)
- [ ] Timestamps will auto-update on modification
- [ ] Ready for Phase 7

---

## Phase 7: Verification Queries

**File**: `docs/MIGRATION_MULTITENANT_COMPANY.sql`  
**Section**: PHASE 8: CREATE MIGRATION VERIFICATION QUERIES

### Query 7.1 - Verify new tables exist
- [ ] Copy query: "SELECT 'companies' as table_name..."
- [ ] Run in SQL Editor
- [ ] Document results:
  ```
  companies: _____ rows
  company_members: _____ rows
  company_tenants: _____ rows
  company_settings: _____ rows
  ```
- [ ] Verify: All > 0 (except company_settings can be 0)

### Query 7.2 - Verify company_id columns added
- [ ] Copy query: "SELECT table_name, column_name..."
- [ ] Run in SQL Editor
- [ ] Verify results:
  ```
  z_api_instances | company_id | uuid | YES
  message_rules | company_id | uuid | YES
  audit_logs | company_id | uuid | YES
  conversations | company_id | uuid | YES
  ```

### Query 7.3 - Verify company-tenant mapping
- [ ] Copy query: "SELECT c.id, c.name, COUNT(ct.tenant_id)..."
- [ ] Run in SQL Editor
- [ ] Document results:
  ```
  Company | Tenants Linked | Instances Linked
  _______ | _____________ | ________________
  ```
- [ ] Verify: All companies have matching tenants and instances

### Query 7.4 - Verify data integrity (no data loss)
- [ ] Copy query: "SELECT 'conversations' as entity, COUNT(*) as total..."
- [ ] Run in SQL Editor
- [ ] Document results:
  ```
  conversations: _____ total, _____ have company_id
  message_rules: _____ total, _____ have company_id
  ```
- [ ] **CRITICAL CHECK**: conversations/message_rules total count must match pre-migration

### Query 7.5 - Compare with pre-migration counts
- [ ] Pre-migration conversation count: _____
- [ ] Post-migration conversation count: _____
- [ ] Match? [ ] YES [ ] NO ⚠️ STOP - DO NOT PROCEED

**Phase 7 Summary**
- [ ] All verification queries executed
- [ ] All results documented
- [ ] No data loss detected
- [ ] Company mappings correct
- [ ] Ready for Phase 8

---

## Phase 8: Test Helper Functions

### Step 8.1 - Test get_user_companies function
- [ ] Run query:
  ```sql
  SELECT * FROM get_user_companies('[master_user_uuid]');
  ```
- [ ] Verify: Returns list of companies with roles

### Step 8.2 - Test user_has_company_role function
- [ ] Run query:
  ```sql
  SELECT user_has_company_role('[master_user_uuid]', 
    (SELECT id FROM companies LIMIT 1), 
    'admin');
  ```
- [ ] Verify: Returns TRUE (master user is admin/owner)

### Step 8.3 - Test get_company_tenants function
- [ ] Run query:
  ```sql
  SELECT * FROM get_company_tenants(
    (SELECT id FROM companies LIMIT 1));
  ```
- [ ] Verify: Returns tenant(s) mapped to company

**Phase 8 Summary**
- [ ] All 3 helper functions tested
- [ ] Functions working correctly
- [ ] Ready for Phase 9 (optional constraints)

---

## Phase 9: OPTIONAL - Add NOT NULL Constraints

**⚠️ OPTIONAL STEP** - Only if you want strict constraints  
**Default**: Keep columns nullable for safety

### Step 9.1 - Review constraint requirements
- [ ] Do you want company_id to be mandatory? [ ] YES [ ] NO
- [ ] If NO: **SKIP this phase, you're done!**
- [ ] If YES: Continue to 9.2

### Step 9.2 - Verify 100% backfill
- [ ] Run query:
  ```sql
  SELECT COUNT(*) FROM z_api_instances WHERE company_id IS NULL;
  ```
- [ ] Result should be: **0**
- [ ] If > 0: **STOP - Do NOT add constraint**

### Step 9.3 - Add NOT NULL constraint to z_api_instances
- [ ] Copy: `ALTER TABLE z_api_instances ALTER COLUMN company_id SET NOT NULL;`
- [ ] Run in SQL Editor
- [ ] Verify: Column altered successfully

### Step 9.4 - Add NOT NULL constraint to message_rules
- [ ] Copy: `ALTER TABLE message_rules ALTER COLUMN company_id SET NOT NULL;`
- [ ] Run in SQL Editor
- [ ] Verify: Column altered successfully

### Step 9.5 - Add UNIQUE constraint
- [ ] Copy: `ALTER TABLE z_api_instances ADD CONSTRAINT z_api_instances_company_instance_unique UNIQUE (company_id, instance_id);`
- [ ] Run in SQL Editor
- [ ] Verify: Constraint added

**Phase 9 Summary**
- [ ] ✅ Phase 9 complete (or SKIPPED if keeping nullable)
- [ ] All constraints in place
- [ ] Migration fully complete!

---

## Post-Migration

### Immediate Actions (Within 1 hour)
- [ ] Monitor Supabase logs for errors
- [ ] Test webhook processing (if applicable)
- [ ] Run quick sanity check queries:
  ```sql
  SELECT COUNT(*) FROM companies;
  SELECT COUNT(*) FROM company_tenants;
  SELECT COUNT(*) FROM z_api_instances WHERE company_id IS NOT NULL;
  ```

### Within 24 Hours
- [ ] Monitor application logs for errors
- [ ] Check any alerts from monitoring system
- [ ] Verify users can still access their data
- [ ] Test company/tenant switching (if applicable)

### Within 1 Week
- [ ] Verify billing system reads company_id correctly
- [ ] Check analytics and reporting with new structure
- [ ] Document any issues found
- [ ] Update application code with company filtering (if needed)

---

## Emergency Rollback Procedure

**Only use if critical issues detected**

### ⚠️ Before Rollback
- [ ] Document the exact error/issue: _______________________
- [ ] Contact team lead
- [ ] Verify backup exists and is good
- [ ] Have backup restore procedure ready

### Rollback Steps (In Reverse Order)

1. **Rollback Phase 9 (if executed)**
   ```sql
   -- Drop constraints
   ALTER TABLE z_api_instances DROP CONSTRAINT z_api_instances_company_instance_unique;
   ALTER TABLE z_api_instances ALTER COLUMN company_id DROP NOT NULL;
   ALTER TABLE message_rules ALTER COLUMN company_id DROP NOT NULL;
   ```

2. **Rollback Phase 8, 7, 6 (Functions & Triggers)**
   ```sql
   DROP TRIGGER IF EXISTS companies_update_updated_at ON companies;
   DROP TRIGGER IF EXISTS company_settings_update_updated_at ON company_settings;
   DROP FUNCTION IF EXISTS migrate_tenants_to_companies() CASCADE;
   DROP FUNCTION IF EXISTS get_user_companies(UUID) CASCADE;
   DROP FUNCTION IF EXISTS user_has_company_role(UUID, UUID, VARCHAR) CASCADE;
   DROP FUNCTION IF EXISTS get_company_tenants(UUID) CASCADE;
   ```

3. **Rollback Phase 5, 4 (Data)**
   ```sql
   -- Clear data (non-destructive, all new tables/columns)
   UPDATE z_api_instances SET company_id = NULL;
   UPDATE message_rules SET company_id = NULL;
   UPDATE audit_logs SET company_id = NULL;
   UPDATE conversations SET company_id = NULL;
   
   DELETE FROM company_settings;
   DELETE FROM company_tenants;
   DELETE FROM company_members;
   DELETE FROM companies;
   ```

4. **Rollback Phase 3, 2, 1 (Schema)**
   ```sql
   -- Drop columns
   ALTER TABLE z_api_instances DROP COLUMN company_id CASCADE;
   ALTER TABLE message_rules DROP COLUMN company_id CASCADE;
   ALTER TABLE audit_logs DROP COLUMN company_id CASCADE;
   ALTER TABLE conversations DROP COLUMN company_id CASCADE;
   
   -- Drop tables
   DROP TABLE IF EXISTS company_settings CASCADE;
   DROP TABLE IF EXISTS company_tenants CASCADE;
   DROP TABLE IF EXISTS company_members CASCADE;
   DROP TABLE IF EXISTS companies CASCADE;
   ```

5. **Restore from Backup** (if needed)
   - [ ] Contact Supabase support
   - [ ] Request restore from backup at: _________________
   - [ ] Verify data integrity post-restore

### Rollback Complete
- [ ] All changes reverted
- [ ] System back to pre-migration state
- [ ] Document what happened for review

---

## Troubleshooting

### Issue: Function creation fails with "Syntax error"
**Solution**: Check that master_user_uuid replacement was done correctly
- [ ] Verify UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
- [ ] Re-run replacement if needed

### Issue: Verification query shows company_count = 0
**Solution**: Migration function may not have executed
- [ ] Run: `SELECT * FROM migrate_tenants_to_companies();`
- [ ] Check status column for error message
- [ ] Check that tenants table has data

### Issue: Rollback fails with "Constraint violation"
**Solution**: Drop constraints manually first
- [ ] Run Phase 9 rollback even if Phase 9 wasn't executed
- [ ] Retry table deletion

### Issue: Backup restore needed
**Solution**: Contact Kairo Lopes (kairo@zapbaratinho.com.br)
- [ ] Provide error message
- [ ] Provide backup date/time if known
- [ ] Have restore procedure from Supabase ready

---

## Sign-Off

**Migration completed by**: ________________________  
**Date**: ________________________  
**Time**: ________________________  
**Environment**: [ ] Development [ ] Staging [ ] Production  

**All phases completed**: [ ] YES [ ] NO (partial completion)

**Issues encountered**: [ ] NONE [ ] YES
If yes, describe:
```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

**Verification Status**
- [ ] All verification queries passed
- [ ] No data loss detected
- [ ] Helper functions working
- [ ] Ready for production use

**Next Steps**
- [ ] Update application code with company_id filtering
- [ ] Deploy application to use new structure
- [ ] Monitor production for 24+ hours
- [ ] Create user documentation for company management

---

**Checklist End**
