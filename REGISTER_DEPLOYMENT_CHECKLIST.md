# Registration Endpoint - Deployment Checklist

## Pre-Deployment Requirements

### Environment Setup
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in `.env.local`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local`
- [ ] `JWT_PRIVATE_KEY` set in `.env.local`
- [ ] `JWT_PUBLIC_KEY` set in `.env.local`
- [ ] `JWT_ISSUER` set (default: iaezap)
- [ ] `JWT_AUDIENCE` set (default: iaezap-api)
- [ ] `JWT_ACCESS_TOKEN_EXPIRY` set (default: 3600 seconds)
- [ ] `JWT_REFRESH_TOKEN_EXPIRY` set (default: 604800 seconds)
- [ ] `NODE_ENV` set appropriately

### Database Setup
- [ ] Supabase project created
- [ ] Service role key generated
- [ ] `companies` table created with schema
  - [ ] `id` (UUID, PK)
  - [ ] `cnpj` (VARCHAR(14), UNIQUE, NOT NULL)
  - [ ] `name` (VARCHAR(255), NOT NULL)
  - [ ] `status` (VARCHAR(50), DEFAULT 'active')
  - [ ] `created_at` (TIMESTAMP)
  - [ ] `updated_at` (TIMESTAMP)
  - [ ] `deleted_at` (TIMESTAMP, nullable)
  - [ ] Index on `cnpj`

- [ ] `users` table created with schema
  - [ ] `id` (UUID, PK)
  - [ ] `email` (VARCHAR(255), UNIQUE, NOT NULL)
  - [ ] `password_hash` (VARCHAR(255), NOT NULL)
  - [ ] `company_id` (UUID, FK to companies.id)
  - [ ] `role` (VARCHAR(50), DEFAULT 'user')
  - [ ] `status` (VARCHAR(50), DEFAULT 'active')
  - [ ] `created_at` (TIMESTAMP)
  - [ ] `updated_at` (TIMESTAMP)
  - [ ] `deleted_at` (TIMESTAMP, nullable)
  - [ ] Index on `email`
  - [ ] Index on `company_id`

### Code Review
- [ ] `src/app/api/auth/register/route.ts` reviewed
- [ ] All imports are correct
- [ ] TypeScript compilation succeeds (`npm run build`)
- [ ] No console errors during build
- [ ] Error handling is comprehensive
- [ ] Security measures implemented
  - [ ] Password validation
  - [ ] Bcrypt hashing
  - [ ] Input sanitization
  - [ ] CORS support

### Dependencies Verification
- [ ] `bcrypt` ^6.0.0 installed
- [ ] `@types/bcrypt` ^6.0.0 installed
- [ ] `@supabase/supabase-js` ^2.112.3 installed
- [ ] `jsonwebtoken` ^9.0.3 installed
- [ ] `zod` available (Next.js 16+)

### Testing
- [ ] Manual registration test with valid data
- [ ] Test with duplicate email (expect 409)
- [ ] Test with invalid password (expect 400)
- [ ] Test with invalid CNPJ (expect 400)
- [ ] Test with invalid email (expect 400)
- [ ] Verify cookies are set correctly
- [ ] Verify token claims are correct
- [ ] Test CORS preflight (OPTIONS request)
- [ ] Verify company auto-creation works
- [ ] Verify first user gets admin role

## Build Verification

```bash
# Run build
npm run build

# Expected output includes:
# ✓ Generating static pages (12/12) in XXXms
# ✓ Route (app)
# ├ ✓ /api/auth/register
```

- [ ] Build completes successfully
- [ ] No TypeScript errors in register route
- [ ] Route listed in build output as dynamic (ƒ)
- [ ] All bundle sizes within limits

## Security Checklist

### Password Security
- [ ] Bcrypt hashing enabled (10 rounds)
- [ ] Passwords never logged
- [ ] Passwords never returned in responses
- [ ] Password hash stored in database
- [ ] Password validation enforced
  - [ ] Minimum 8 characters
  - [ ] Uppercase letter required
  - [ ] Lowercase letter required
  - [ ] Digit required
  - [ ] Special character required

### Token Security
- [ ] JWT signing implemented
- [ ] RS256 algorithm used
- [ ] Tokens include expiration
- [ ] Refresh token in HTTP-only cookie
- [ ] Access token accessible to client
- [ ] Secure flag set in production
- [ ] SameSite=lax configured
- [ ] Token verification implemented

### Input Validation
- [ ] Zod schema validation
- [ ] Email format checked
- [ ] CNPJ format validated (14 digits)
- [ ] Company name length checked
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection (via cookies)

### Error Handling
- [ ] Error messages don't leak system details (production)
- [ ] Consistent error response format
- [ ] Proper HTTP status codes
- [ ] Error logging implemented
- [ ] Debugging info only in development mode

## Performance Checklist

- [ ] Bcrypt hashing time acceptable (~100-200ms)
- [ ] Database queries optimized
  - [ ] Index on companies.cnpj
  - [ ] Index on users.email
  - [ ] Index on users.company_id
- [ ] Token generation fast (<10ms)
- [ ] Total endpoint time <500ms typical
- [ ] Memory usage within limits

## Deployment Steps

### Step 1: Environment Variables
```bash
# Copy production variables to .env.production or deployment platform
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export JWT_PRIVATE_KEY=...
export JWT_PUBLIC_KEY=...
```

### Step 2: Database Migration
```bash
# Execute schema in REGISTER_DATABASE_SCHEMA.sql
# Via Supabase dashboard or CLI
supabase db push
```

### Step 3: Build
```bash
npm install
npm run build
```

### Step 4: Verify
```bash
# Test registration endpoint
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "company_cnpj": "12345678901234",
    "company_name": "Test Company"
  }'
```

### Step 5: Monitor
- [ ] Check application logs
- [ ] Monitor error rates
- [ ] Track response times
- [ ] Monitor database performance
- [ ] Check token generation
- [ ] Verify cookie handling

## Post-Deployment

### Monitoring
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Set up performance monitoring
- [ ] Set up database monitoring
- [ ] Set up log aggregation
- [ ] Set up alerts for failures

### Maintenance
- [ ] Regular security audits
- [ ] Monitor bcrypt performance
- [ ] Update dependencies regularly
- [ ] Review access logs
- [ ] Backup database regularly

### Optional Enhancements
- [ ] Rate limiting on registration
- [ ] Email verification flow
- [ ] CAPTCHA integration
- [ ] Audit logging
- [ ] Two-factor authentication
- [ ] IP whitelist/blacklist

## Rollback Plan

If issues occur:

### Quick Rollback
```bash
# Revert to previous version
git revert <commit-hash>
npm run build
# Redeploy
```

### Database Rollback
- Keep backup of previous schema
- Soft-delete records if needed
- Restore from backup if critical

### Monitoring Rollback
- Check error rates
- Verify database connectivity
- Confirm JWT signing works
- Test registration flow

## Success Criteria

- [x] Code implemented and builds successfully
- [x] All features working as specified
  - [x] Input validation
  - [x] Company existence check
  - [x] Company auto-creation
  - [x] Password hashing
  - [x] User creation
  - [x] JWT token generation
  - [x] HTTP-only cookies
  - [x] Error handling
- [x] Security measures implemented
- [x] Error handling comprehensive
- [x] Documentation complete
- [x] Database schema provided
- [ ] Deployed to staging
- [ ] Tested in staging environment
- [ ] Deployed to production
- [ ] Verified in production
- [ ] Monitored for 24 hours

## Documentation Deliverables

- [x] `REGISTRATION_ENDPOINT_GUIDE.md` - Complete technical reference
- [x] `REGISTER_QUICK_START.md` - Quick reference guide
- [x] `REGISTRATION_IMPLEMENTATION_SUMMARY.md` - Implementation overview
- [x] `REGISTER_DATABASE_SCHEMA.sql` - Database schema
- [x] `REGISTER_DEPLOYMENT_CHECKLIST.md` - This file

## Support Contacts

- **Supabase Support:** https://supabase.com/support
- **Next.js Documentation:** https://nextjs.org/docs
- **Bcrypt Documentation:** https://www.npmjs.com/package/bcrypt
- **JWT Documentation:** https://jwt.io

## Appendix: Common Issues & Solutions

### Issue: "Missing Supabase environment variables"
**Solution:** Ensure `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

### Issue: "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY required"
**Solution:** Generate RSA keys:
```bash
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
# Then add to .env.local
```

### Issue: "CNPJ must be exactly 14 digits"
**Solution:** Remove formatting from CNPJ:
```
Invalid:  12.345.678/0001-34
Valid:    12345678000134
```

### Issue: User registration succeeds but no token returned
**Solution:** Check JWT configuration:
- Verify keys are correctly loaded
- Check error logs for JWT signing errors
- Ensure NODE_ENV is set correctly

### Issue: Cookies not being set
**Solution:** Check browser settings:
- HTTPS required in production (secure flag)
- Check SameSite policy
- Verify credentials: 'include' in fetch

### Issue: "User already exists" but registration was first attempt
**Solution:** Check for:
- Previous successful registrations
- Test data in database
- Email duplication (case sensitivity)

## Approval Sign-Off

- [ ] Tech Lead Reviewed
- [ ] Security Team Approved
- [ ] DevOps Approved
- [ ] Product Owner Signed Off
- [ ] Ready for Production

---

**Last Updated:** 2026-08-13
**Version:** 1.0.0
**Status:** Ready for Deployment
