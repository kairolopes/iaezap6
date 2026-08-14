# Final Deployment Verification Report

**Generated:** 2026-08-14T14:08:07.487Z

## Deployment Status

**Overall Status:** `DEPLOYMENT_INCOMPLETE`

---

## Verification Results

### 1. Tables Count
- **Expected:** 4
- **Actual:** 3
- **Status:** ✗ FAIL
- **Tables Found:** users, company_members, z_api_instances

### 2. Companies Count
- **Expected:** 1
- **Actual:** 0
- **Status:** ✗ FAIL

### 3. Users Count
- **Expected:** 1
- **Actual:** 0
- **Status:** ✗ FAIL

### 4. Z-API Instances Backfilled
- **Expected:** 100%
- **Actual:** 0%
- **Details:** 0/2 instances
- **Status:** ✗ FAIL

### 5. Indexes Count
- **Expected:** 25+
- **Actual:** UNKNOWN
- **Status:** ⚠ UNKNOWN
- **Note:** Requires direct PostgreSQL access

### 6. RLS Policies Count
- **Expected:** 13+
- **Actual:** UNKNOWN
- **Status:** ⚠ UNKNOWN
- **Note:** Requires direct PostgreSQL access

### 7. Master User
- **Exists:** ✗ NO
- **Verified:** ✗ NO
- **Status:** ✗ FAIL


---

## Summary

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Tables | 4 | 3 | ✗ |
| Companies | 1 | 0 | ✗ |
| Users | 1 | 0 | ✗ |
| Z-API Backfill | 100% | 0% | ✗ |
| Indexes | 25+ | UNKNOWN | ⚠ |
| RLS Policies | 13+ | UNKNOWN | ⚠ |
| Master User | Yes & Verified | No | ✗ |


## Failures

1. Only 3 of 4 expected tables found
2. Companies check failed: Companies table error: 
3. Only 0 of 1 expected user found
4. Z-API backfill incomplete: 0% (0/2)
5. Master user check failed: Master user query failed: Could not find the table 'public.users' in the schema cache


---

## Database Information

- **URL:** https://gqromcfhiosfppqlottz.supabase.co
- **Timestamp:** 2026-08-14T14:08:07.487Z

## Notes

- Indexes and RLS Policies verification requires direct PostgreSQL access
- Use the PostgreSQL connection from your Supabase dashboard for complete verification
- Query: `SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_%';`
- Query: `SELECT COUNT(*) FROM pg_policies;`

---

**Report Generated:** 14/08/2026, 11:08:11
