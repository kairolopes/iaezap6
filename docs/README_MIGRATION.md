# Multi-Tenant Company Migration - Complete Documentation

**Status**: 🟢 Ready for Execution  
**Version**: 1.0  
**Last Updated**: 2026-08-13  
**Owner**: Kairo Lopes (kairo@zapbaratinho.com.br)

---

## Quick Start

### For Executives
**What's Happening**: Adding company-level organization to the IAeZap system.

**Impact**: 
- ✅ Zero downtime
- ✅ No data loss
- ✅ Reversible at any step
- ✅ Fully backward compatible

**Timeline**: 1-2 hours to execute

---

### For Developers

**Read This First**: [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)

**Then Execute**: [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)

**Reference**: [MIGRATION_DATA_MODEL.md](./MIGRATION_DATA_MODEL.md)

**SQL Script**: [MIGRATION_MULTITENANT_COMPANY.sql](./MIGRATION_MULTITENANT_COMPANY.sql)

---

## Document Overview

| Document | Purpose | Read Time | For Whom |
|----------|---------|-----------|----------|
| **[MIGRATION_PLAN.md](./MIGRATION_PLAN.md)** | Detailed strategy, phases, risks, verification | 15 min | Developers, Architects |
| **[MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)** | Step-by-step execution guide | 30 min | Person executing migration |
| **[MIGRATION_DATA_MODEL.md](./MIGRATION_DATA_MODEL.md)** | Schema changes, relationships, ERD | 10 min | Developers, DBAs |
| **[MIGRATION_MULTITENANT_COMPANY.sql](./MIGRATION_MULTITENANT_COMPANY.sql)** | Complete SQL script | Reference | DBAs, Executors |

---

## What Gets Changed?

### ✅ NEW (Added)
- `companies` table
- `company_members` table (user ↔ company mapping)
- `company_tenants` table (company ↔ tenant mapping)
- `company_settings` table
- `company_id` column on 4 existing tables
- Helper functions for company operations
- Automatic timestamp triggers

### ❌ NOT CHANGED (Preserved)
- ✅ `conversations` table structure (data only gets company_id column)
- ✅ `messages` table (completely unchanged)
- ✅ `message_rules` table structure (data preserved, only company_id added)
- ✅ `tenants` table structure
- ✅ `users_tenants` relationships
- ✅ All authentication
- ✅ All message processing

---

## Safe Design Principles

### 1. **Nullable Columns**
New `company_id` columns start as NULL, can be left nullable indefinitely.

### 2. **Reversible Phases**
Each migration phase is independently reversible (see rollback procedures).

### 3. **Zero Downtime**
No table locks, no data migration blocking, queries continue to work.

### 4. **Backward Compatible**
Existing code works without changes initially. Company filtering optional.

### 5. **Verification at Each Step**
Built-in verification queries to confirm success before proceeding.

---

## Before You Start

### Pre-Migration Checklist
- [ ] **Backup**: Full database backup created and tested
- [ ] **Team**: Key team members available for 2 hours
- [ ] **Access**: Supabase dashboard access confirmed
- [ ] **Testing**: Staging environment available
- [ ] **Downtime**: Any user-facing downtime approved
- [ ] **Rollback**: Rollback procedures reviewed and understood

### Required Information
You'll need:
- [ ] Master user email (kairo@zapbaratinho.com.br)
- [ ] Master user UUID (from Supabase Auth after creation)
- [ ] Current database name (for backup reference)
- [ ] Slack/email for team communication

---

## Execution Overview

### Phase 1-3: Infrastructure (15 minutes)
```
Step 1: Create 4 new tables
Step 2: Add company_id columns to 4 existing tables
Step 3: Create master user account in Supabase Auth
```

**Risk Level**: 🟢 MINIMAL
- No data touched
- No downtime
- Easy rollback

### Phase 4: Data Migration (30 minutes)
```
Step 4.1: Create companies from existing tenants
Step 4.2: Create company↔tenant mappings
Step 4.3: Backfill company_id in all affected tables
```

**Risk Level**: 🟡 MEDIUM
- Data is modified (but not destructively)
- Requires verification
- Have backup ready

### Phase 5-8: Setup & Verification (30 minutes)
```
Step 5: Create helper functions
Step 6: Add auto-timestamp triggers
Step 7: Run verification queries
Step 8: Test helper functions
```

**Risk Level**: 🟢 MINIMAL
- Functions, not data
- All read-only queries
- Comprehensive verification

---

## Key Decisions Made

### 1. Company Hierarchy: 1 Tenant → 1 Company (MVP)
**Design**: Each existing tenant becomes its own company initially.

```
Tenant "Acme Corp" → Company "Acme Corp"
Tenant "Widgets Inc" → Company "Widgets Inc"
Tenant "Services LLC" → Company "Services LLC"
```

**Why**: Simplest migration path. Later, can consolidate multiple tenants into 1 company.

### 2. Nullable company_id Columns
**Design**: New columns start as NULL, backfilled during Phase 4.

**Why**: 
- Existing queries work unchanged
- Gradual adoption possible
- Safe rollback anytime
- Optional NOT NULL constraint (Phase 9)

### 3. Master User as Company Owner
**Design**: Special system admin account owns all companies initially.

**Why**:
- Clear authorization
- Can transfer ownership later
- Simplifies initial setup
- Follows SaaS patterns

### 4. No RLS Changes (For MVP)
**Design**: Keep existing RLS policies. Add company filtering at application layer.

**Why**:
- Simpler migration
- Less risk of permission issues
- Application-level control more flexible
- Can add RLS policies later

---

## Rollback at a Glance

If anything goes wrong at any phase:

1. **Phase 1-3 Rollback**: Delete new tables/columns (5 minutes)
2. **Phase 4 Rollback**: Clear company_id values, delete companies (5 minutes)
3. **Phase 5-8 Rollback**: Drop functions, triggers (2 minutes)
4. **Full Restore**: Restore from backup (varies by backup size)

**Total recovery time**: < 15 minutes (or backup restore time)

---

## Success Criteria

Migration is successful when:

✅ All new tables created  
✅ All new columns added  
✅ All companies created from tenants  
✅ All mappings correct (company↔tenant)  
✅ All z_api_instances linked to companies  
✅ All message_rules linked to companies  
✅ All verification queries pass  
✅ No data loss in protected tables  
✅ Helper functions work correctly  
✅ No error messages in logs  

---

## Application Integration (Post-Migration)

**After executing this migration, you'll need to update your application code:**

### 1. Add Company Context to Requests
```typescript
// middleware.ts
const companyId = extractCompanyFromPath(request);
context.companyId = companyId;
```

### 2. Filter Queries by Company
```typescript
// Before:
.from('conversations').select('*')

// After:
.from('conversations')
  .select('*')
  .eq('company_id', companyId)  // Add this
```

### 3. Verify Company Access
```typescript
// Check user has access to company
const hasAccess = await getHelper('user_has_company_role')(
  userId, 
  companyId, 
  'member'
);
```

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) "Application Integration" section for full examples.

---

## Monitoring & Support

### During Migration
**What to watch**: Supabase logs, database response times, error rates

**Expected**: No errors, ~30 seconds for each SQL batch, 0 error rate

**If issues**: Check Supabase status, review logs, pause and investigate

### After Migration
**First 24 hours**: Monitor application logs, user feedback, error rates

**First week**: Verify company/tenant switching, billing integration, reporting

**First month**: Full user testing, production validation

### Getting Help
**Contact**: Kairo Lopes (kairo@zapbaratinho.com.br)

**Include**:
1. Error message (if any)
2. Which phase failed
3. Exact SQL that failed (if applicable)
4. Backup status

---

## FAQ

### Q: Will this cause downtime?
**A**: No. Migration uses ALTER TABLE and CREATE statements that don't lock tables. All existing queries continue to work.

### Q: What if I mess something up?
**A**: You can:
1. Rollback the last phase (takes 5-15 minutes)
2. Restore from backup (takes longer)
3. Contact Kairo for support

### Q: Do I have to run all phases at once?
**A**: No. Each phase can be run separately, but must follow order (1→2→3→4→5→6→7→8→9).

### Q: What about existing data?
**A**: Completely preserved. Conversations, messages, and message_rules are never modified destructively. Only new company_id column added, initially NULL.

### Q: Can I skip any phases?
**A**: Almost:
- Phase 1-6: **Required** (core infrastructure)
- Phase 7: **Highly recommended** (verification)
- Phase 9: **Optional** (only if you want strict NOT NULL constraints)

### Q: How do I know it worked?
**A**: Run the verification queries in Phase 7. They confirm all data is correct.

### Q: What if verification queries fail?
**A**: 
1. Stop immediately
2. Review error messages
3. Check backup is ready
4. Contact Kairo for guidance
5. **Do not proceed to next phase**

### Q: Do users need to do anything?
**A**: No. Their data, permissions, and access remain unchanged.

### Q: Will this affect webhooks?
**A**: No. Z-API webhooks will continue to work. Instance lookup (tenant_id) unchanged.

### Q: Do I need to update my application?
**A**: Eventually yes, but not immediately. The migration is backward compatible. Update application code to filter by company_id when ready.

---

## Common Issues & Solutions

### Issue 1: Migration function returns ERROR
**Cause**: Master user UUID not found or placeholder not replaced  
**Solution**: 
1. Verify master user was created in Supabase Auth
2. Check UUID format is correct: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
3. Re-run replacement (Find & Replace) if needed

### Issue 2: Verification query shows 0 companies
**Cause**: Migration function didn't execute correctly  
**Solution**:
1. Run: `SELECT * FROM migrate_tenants_to_companies();` manually
2. Check returned status (should be 'SUCCESS')
3. If ERROR, check error message for specific issue

### Issue 3: Cannot rollback - constraint violation
**Cause**: Trying to delete tables in wrong order  
**Solution**: 
1. Delete `company_tenants` BEFORE `companies`
2. Delete `company_members` BEFORE `companies`
3. Follow rollback order exactly as documented

### Issue 4: After migration, company_id is NULL
**Cause**: Backfill didn't execute or failed  
**Solution**:
1. Check migration function result
2. Run backfill manually:
   ```sql
   UPDATE z_api_instances zai
   SET company_id = c.id
   FROM companies c
   WHERE zai.tenant_id::UUID = (c.metadata->>'migrated_from_tenant')::UUID
   AND zai.company_id IS NULL;
   ```
3. Verify count of updated rows

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Pre-migration prep | 15 min | Backup, checklist |
| Phase 1 | 5 min | Create tables |
| Phase 2 | 10 min | Add columns |
| Phase 3 | 5 min | Create master user (manual) |
| Phase 4 | 30 min | Backfill data |
| Phase 5 | 5 min | Create functions |
| Phase 6 | 2 min | Add triggers |
| Phase 7 | 10 min | Verification |
| Phase 8 | 5 min | Test functions |
| Phase 9 (optional) | 5 min | Add constraints |
| **Total** | **~60-90 min** | Depends on verification |

---

## Next Steps After Migration

### Immediate (Today)
1. ✅ Execute migration using MIGRATION_CHECKLIST.md
2. ✅ Run all verification queries
3. ✅ Document results
4. ✅ Commit changes to git (if migrations tracked)

### Short Term (This Week)
1. Update application code to use company_id filtering
2. Test company/tenant switching functionality
3. Deploy updated application
4. Monitor logs for errors

### Medium Term (This Month)
1. Update documentation for company management
2. Create UI for company switching (if multi-tenant)
3. Implement company billing/usage tracking
4. Test with actual users
5. Train support team on company structure

### Long Term (This Quarter)
1. Plan Phase 2 enhancements:
   - Multiple tenants per company
   - Company API keys
   - Company billing integration
   - Company audit reporting

---

## Document Map

```
README_MIGRATION.md (YOU ARE HERE)
├── MIGRATION_PLAN.md
│   ├── Detailed phase-by-phase breakdown
│   ├── Risk assessment
│   ├── Verification queries
│   └── Rollback procedures
├── MIGRATION_CHECKLIST.md
│   ├── Step-by-step execution guide
│   ├── Forms to fill in results
│   ├── Troubleshooting tips
│   └── Sign-off section
├── MIGRATION_DATA_MODEL.md
│   ├── Schema diagrams
│   ├── Relationship maps
│   ├── Query examples
│   └── Testing checklist
└── MIGRATION_MULTITENANT_COMPANY.sql
    ├── Complete SQL script
    ├── Phase-by-phase sections
    ├── Verification queries
    └── Rollback SQL commands
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-13 | Initial release - Complete migration strategy |

---

## Sign-Off

**Migration Documentation Prepared By**: Kairo Lopes  
**Date**: 2026-08-13  
**Status**: ✅ Ready for Execution

**Review Completed By**: _______________  
**Date**: _______________  
**Approval**: [ ] APPROVED [ ] NEEDS CHANGES

---

## Contact & Support

**For Questions**: kairo@zapbaratinho.com.br

**For Issues During Migration**:
1. Document exact error message
2. Note which phase/step failed
3. Check backup is ready
4. Contact Kairo with details
5. Have rollback procedure ready

---

**End of Migration Documentation**
