# Master Admin Endpoints - Deployment Checklist

Use this checklist to deploy the master admin endpoints to production.

## Pre-Deployment

### 1. Code Review
- [ ] Review all TypeScript code for type safety
- [ ] Verify all validation rules are correct
- [ ] Check error handling is comprehensive
- [ ] Verify no secrets in code
- [ ] Check for console.log statements (remove non-debug logs)

### 2. Environment Setup
- [ ] Verify SUPABASE_SERVICE_ROLE_KEY is set
- [ ] Verify NEXT_PUBLIC_SUPABASE_URL is set
- [ ] Verify NODE_ENV is set correctly
- [ ] Check all dependencies are installed
- [ ] Run `npm install` to update lock file

### 3. Database Preparation
- [ ] Backup production database
- [ ] Create backup of companies table
- [ ] Create backup of users table
- [ ] Verify migration script is tested
- [ ] Test rollback procedure

### 4. Testing
- [ ] Run all unit tests: `npm test`
- [ ] Run integration tests: `npm test -- integration`
- [ ] Manual test all 4 endpoints
- [ ] Test error cases (401, 403, 404, 409, 400)
- [ ] Test with Postman/Insomnia
- [ ] Load test with k6 or locust
- [ ] Test with real data volume

### 5. Documentation Review
- [ ] Review API documentation for accuracy
- [ ] Check all examples work correctly
- [ ] Verify error codes match implementation
- [ ] Check parameter documentation is complete
- [ ] Review security section for completeness

## Pre-Production Deployment

### 1. Database Migration

**Step 1: Backup**
```bash
# Backup companies table
pg_dump -t companies > companies_backup.sql

# Verify backup
psql < companies_backup.sql --dry-run
```

**Step 2: Run Migration**
```sql
-- Run in Supabase SQL editor
-- File: src/lib/auth/002_add_cnpj_to_companies.sql

ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18) UNIQUE NOT NULL DEFAULT '';

-- Create validation trigger
CREATE OR REPLACE FUNCTION validate_cnpj()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj !~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid CNPJ format. Expected: XX.XXX.XXX/XXXX-XX';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_validate_cnpj ON companies;
CREATE TRIGGER companies_validate_cnpj
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION validate_cnpj();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_owner_id_active ON companies(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_status_created_at ON companies(status, created_at DESC) WHERE deleted_at IS NULL;
```

**Step 3: Verify Migration**
```sql
-- Check column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'companies' AND column_name = 'cnpj';

-- Check trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name LIKE 'companies_validate_cnpj';

-- Check indexes exist
SELECT indexname FROM pg_indexes
WHERE tablename = 'companies' AND indexname LIKE '%cnpj%';
```

**Step 4: Test**
```sql
-- Test CNPJ validation works
INSERT INTO companies (name, slug, cnpj, owner_id, status)
VALUES ('Test', 'test-slug', 'invalid-cnpj', 'user-uuid', 'active');
-- Should fail with validation error

INSERT INTO companies (name, slug, cnpj, owner_id, status)
VALUES ('Test', 'test-slug-2', '12.345.678/0001-90', 'user-uuid', 'active');
-- Should succeed
```

### 2. Code Deployment

**Step 1: Build**
```bash
npm run build
# Should complete without errors
```

**Step 2: Test Build**
```bash
npm run start
# Test endpoints locally

curl http://localhost:3000/api/admin/companies \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Step 3: Deploy**
```bash
# Option 1: Vercel
vercel deploy --prod

# Option 2: Docker
docker build -t iaezap-admin .
docker push your-registry/iaezap-admin

# Option 3: PM2
pm2 start ecosystem.config.js --env production
```

### 3. Post-Deployment Verification

**Smoke Tests (run immediately after deploy)**

```bash
# Test 1: Health check
curl http://your-domain/api/admin/companies \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: 200 or 401 (no 5xx)

# Test 2: Create company
curl -X POST http://your-domain/api/admin/companies \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company",
    "slug": "test-smoke-'$(date +%s)'",
    "cnpj": "12.345.678/0001-90"
  }'
# Expected: 201 Created

# Test 3: List companies
curl http://your-domain/api/admin/companies?limit=1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: 200 OK with data array

# Test 4: Error handling
curl http://your-domain/api/admin/companies
# Expected: 401 Unauthorized (not 500)

# Test 5: Authorization
curl http://your-domain/api/admin/companies \
  -H "Authorization: Bearer $USER_TOKEN"
# Expected: 403 Forbidden (not 500)
```

### 4. Monitoring Setup

**Step 1: Configure Logging**

```typescript
// src/lib/logger.ts
import * as Sentry from "@sentry/nextjs";

export const logAdminAction = (action: string, data: any) => {
  console.log(`[ADMIN] ${action}`, data);
  
  // Send to monitoring service
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(`Admin action: ${action}`, 'info');
  }
};
```

**Step 2: Set Up Error Tracking**

```typescript
// next.config.ts
const withSentry = require("@sentry/nextjs/withSentryConfig");

module.exports = withSentry({
  // ...your config
});
```

**Step 3: Set Up Performance Monitoring**

- [ ] Enable Sentry Performance Monitoring
- [ ] Set up DataDog APM (if using)
- [ ] Configure CloudWatch metrics (if using AWS)
- [ ] Set up custom dashboards

### 5. Security Verification

**Step 1: Security Headers**

```typescript
// next.config.ts
headers: [
  {
    source: '/api/admin/:path*',
    headers: [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY'
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
      }
    ]
  }
]
```

**Step 2: Rate Limiting**

```typescript
// src/middleware.ts
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'),
});

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const identifier = request.ip || 'anonymous';
    const { success } = await ratelimit.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
  }
}
```

**Step 3: Test Security**

- [ ] Test CORS is working correctly
- [ ] Test CSRF protection (if applicable)
- [ ] Test rate limiting
- [ ] Test token validation
- [ ] Test authorization checks
- [ ] Run OWASP ZAP scan

## Production Checklist

### Daily (first week after deploy)

- [ ] Monitor error rates
- [ ] Check response times
- [ ] Review logs for unusual activity
- [ ] Verify all endpoints responding
- [ ] Check database performance
- [ ] Monitor CPU/memory usage

### Weekly (first month)

- [ ] Review error logs for patterns
- [ ] Check security logs
- [ ] Verify backups are working
- [ ] Test rollback procedure
- [ ] Review performance metrics
- [ ] Analyze API usage patterns

### Monthly

- [ ] Performance review
- [ ] Security audit
- [ ] Database optimization
- [ ] Update dependencies
- [ ] Review and update documentation
- [ ] Capacity planning

## Rollback Plan

**If Issues Occur:**

```bash
# Option 1: Revert code to previous version
git revert HEAD
npm run build
# Redeploy

# Option 2: Disable endpoints
# Add feature flag to disable /api/admin routes
export DISABLE_ADMIN_ENDPOINTS=true

# Option 3: Full database rollback
psql < companies_backup.sql
```

## Integration Verification

### 1. Admin Dashboard Integration

- [ ] Admin dashboard can create companies
- [ ] Admin dashboard can list companies
- [ ] Admin dashboard can add users
- [ ] Admin dashboard can list users
- [ ] Error handling works in UI
- [ ] Loading states work correctly

### 2. Authentication Integration

- [ ] JWT tokens work with endpoints
- [ ] Token refresh works
- [ ] Logout invalidates token
- [ ] Session persistence works

### 3. Database Integration

- [ ] Companies appear in database
- [ ] Users appear in database
- [ ] Soft deletes work correctly
- [ ] Indexes are being used
- [ ] Constraints are enforced

## Documentation Updates

- [ ] Update API documentation with live endpoints
- [ ] Update deployment guides
- [ ] Update troubleshooting guide
- [ ] Update architecture diagrams
- [ ] Update team wiki/internal docs
- [ ] Update README with new features

## Training & Communication

- [ ] Train support team on endpoints
- [ ] Notify developers of new endpoints
- [ ] Create internal wiki page
- [ ] Document common use cases
- [ ] Record demo/training video
- [ ] Send announcement to team

## Performance Benchmarks

Record these metrics before and after:

```
Metric                    Target      Actual
Response time (avg)       < 200ms     ___ms
Response time (p95)       < 500ms     ___ms
Response time (p99)       < 1000ms    ___ms
Error rate                < 0.1%      ___%
CPU usage                 < 40%       __%
Memory usage              < 60%       __%
Database query time       < 100ms     ___ms
Requests per second       > 100       ___/s
```

## Compliance & Security

- [ ] GDPR compliance verified
- [ ] Data encryption verified
- [ ] Access control tested
- [ ] Audit logging works
- [ ] Compliance documentation updated
- [ ] Security review completed

## Final Checklist Before Going Live

- [ ] All tests passing
- [ ] Security verified
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] Team trained
- [ ] Monitoring set up
- [ ] Alerting configured
- [ ] Backups working
- [ ] Rollback plan ready
- [ ] stakeholders notified

## Post-Launch Follow-up (1 week)

- [ ] Gather user feedback
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Review security logs
- [ ] Update documentation based on usage
- [ ] Plan next improvements

## Post-Launch Follow-up (1 month)

- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Database optimization
- [ ] Capacity planning
- [ ] Update benchmarks
- [ ] Plan Phase 2 features

---

**Sign-off**

- [ ] QA Lead Approval: _________________ Date: _____
- [ ] DevOps Lead Approval: _________________ Date: _____
- [ ] Security Lead Approval: _________________ Date: _____
- [ ] Product Lead Approval: _________________ Date: _____

**Deployment Date/Time:** _____________________

**Deployed By:** _____________________

**Contact for Issues:** _____________________
