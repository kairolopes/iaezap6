# Master Admin Endpoints - Documentation Index

Welcome to the Master Admin Endpoints documentation for IAeZap. This index helps you navigate all documentation and quickly find what you need.

## Quick Links

**I want to...**

- [Get Started Immediately](#quick-start) → Go to Quick Reference
- [Understand the Architecture](#architecture) → Go to Implementation Guide
- [See All Endpoints](#endpoints) → Go to API Documentation
- [Copy-Paste Examples](#examples) → Go to Quick Reference
- [Troubleshoot an Issue](#troubleshooting) → Go to Quick Reference
- [Understand Integration](#integration) → Go to Implementation Guide

## Documentation Files

### 📖 MASTER_ADMIN_SUMMARY.md
**Overview of all master admin endpoints**

- Feature summary
- Files created
- Quick example usage
- Implementation checklist
- Error codes reference

**Read this when:** You want a high-level overview of what was built

**Time to read:** 5 minutes

---

### 🚀 MASTER_ADMIN_QUICK_REFERENCE.md
**Fast reference for developers**

- Endpoint summary table
- Setup instructions
- cURL examples
- JavaScript/TypeScript client code
- Common issues & fixes
- Validation rules
- Testing checklist

**Read this when:** 
- You want to start using the API quickly
- You need a cURL example
- You're debugging an error
- You need validation rules

**Time to read:** 10 minutes

---

### 📚 MASTER_ADMIN_ENDPOINTS.md
**Complete API reference documentation**

- Full endpoint documentation
- Request/response schemas
- Query parameters
- Status codes
- Error responses
- Security considerations
- Rate limiting info
- Future enhancements

**Read this when:**
- You need detailed API documentation
- You want to understand all parameters
- You need comprehensive error handling
- You're implementing client code

**Time to read:** 20 minutes

---

### 🏗️ MASTER_ADMIN_IMPLEMENTATION_GUIDE.md
**Technical implementation details**

- Architecture overview
- Component breakdown
- Data flow examples
- Database schema integration
- Auth system integration
- Error handling strategy
- Performance considerations
- Testing strategy
- Troubleshooting guide

**Read this when:**
- You need to understand how it works
- You're debugging complex issues
- You need architecture diagrams
- You're extending the system

**Time to read:** 25 minutes

---

### 📋 MASTER_ADMIN_INDEX.md
**This file**

Navigation guide for all documentation

**Read this when:** You need to find something

## Feature Map

### Create Company
- **Endpoint:** `POST /api/admin/companies`
- **Doc Location:** ENDPOINTS.md → Endpoint 1
- **Quick Ref:** QUICK_REFERENCE.md → Create Company
- **Example:** QUICK_REFERENCE.md → cURL Examples

### List Companies
- **Endpoint:** `GET /api/admin/companies`
- **Doc Location:** ENDPOINTS.md → Endpoint 2
- **Quick Ref:** QUICK_REFERENCE.md → List Companies
- **Example:** QUICK_REFERENCE.md → cURL Examples

### Add User to Company
- **Endpoint:** `POST /api/admin/companies/{id}/users`
- **Doc Location:** ENDPOINTS.md → Endpoint 3
- **Quick Ref:** QUICK_REFERENCE.md → Add User
- **Example:** QUICK_REFERENCE.md → cURL Examples

### List Company Users
- **Endpoint:** `GET /api/admin/companies/{id}/users`
- **Doc Location:** ENDPOINTS.md → Endpoint 4
- **Quick Ref:** QUICK_REFERENCE.md → List Users
- **Example:** QUICK_REFERENCE.md → cURL Examples

## Code Reference Map

### Type Definitions
- **File:** `src/types/admin.ts`
- **Location in docs:** IMPLEMENTATION_GUIDE.md → Component 1
- **Contains:** Validation schemas, type definitions, status codes

### Auth Middleware
- **File:** `src/lib/admin/auth.ts`
- **Location in docs:** IMPLEMENTATION_GUIDE.md → Component 2
- **Key Functions:**
  - `withMasterAuth()` - Protection middleware
  - `isMasterUser()` - Role check
  - `formatErrorResponse()` - Error formatting

### Database Operations
- **File:** `src/lib/admin/database.ts`
- **Location in docs:** IMPLEMENTATION_GUIDE.md → Component 3
- **Key Functions:**
  - `companyOperations` - Company CRUD
  - `userOperations` - User CRUD

### API Routes
- **Files:** 
  - `src/app/api/admin/companies/route.ts`
  - `src/app/api/admin/companies/[companyId]/users/route.ts`
- **Location in docs:** IMPLEMENTATION_GUIDE.md → Component 4

## Common Tasks

### I want to...

#### ...create a company
1. Read: QUICK_REFERENCE.md → Create Company section
2. See example: QUICK_REFERENCE.md → Curl Examples
3. Understand request format: ENDPOINTS.md → Endpoint 1
4. Check validation rules: QUICK_REFERENCE.md → Validation Rules

#### ...list companies with filters
1. Read: QUICK_REFERENCE.md → List Companies section
2. See example: QUICK_REFERENCE.md → Curl Examples
3. Understand parameters: ENDPOINTS.md → Endpoint 2
4. Check pagination: QUICK_REFERENCE.md or ENDPOINTS.md

#### ...add a user to a company
1. Read: QUICK_REFERENCE.md → Add User section
2. See example: QUICK_REFERENCE.md → Curl Examples
3. Check roles: QUICK_REFERENCE.md → Validation Rules
4. Understand response: ENDPOINTS.md → Endpoint 3

#### ...debug an authorization error
1. Check error code: QUICK_REFERENCE.md → Common Issues
2. Understand cause: IMPLEMENTATION_GUIDE.md → Error Handling
3. Find solution: QUICK_REFERENCE.md → Common Issues

#### ...understand the architecture
1. Overview: SUMMARY.md
2. Visual diagrams: IMPLEMENTATION_GUIDE.md → Architecture Overview
3. Component details: IMPLEMENTATION_GUIDE.md → Component Breakdown
4. Data flows: IMPLEMENTATION_GUIDE.md → Data Flow Examples

#### ...set up JWT token
1. Instructions: QUICK_REFERENCE.md → Setup section
2. Code example: QUICK_REFERENCE.md → Generate Admin Token
3. Verification: IMPLEMENTATION_GUIDE.md → Integration section

#### ...create a client library
1. Example code: QUICK_REFERENCE.md → JavaScript/TypeScript Client
2. Request format: ENDPOINTS.md → All endpoints
3. Error handling: IMPLEMENTATION_GUIDE.md → Error Handling

#### ...test the endpoints
1. Setup: QUICK_REFERENCE.md → Setup section
2. cURL examples: QUICK_REFERENCE.md → Curl Examples
3. Checklist: QUICK_REFERENCE.md → Testing Checklist
4. Cases: IMPLEMENTATION_GUIDE.md → Testing Strategy

## Status Codes Quick Reference

| Status | Meaning | Common Cause |
|--------|---------|--------------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful POST request |
| 400 | Bad Request | Validation error or invalid format |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Not master/admin user |
| 404 | Not Found | Company/user doesn't exist |
| 409 | Conflict | Duplicate slug or user exists |
| 500 | Server Error | Unexpected error |

**See:** QUICK_REFERENCE.md → Status Codes or ENDPOINTS.md → Error Responses

## Error Code Reference

| Code | Status | Fix |
|------|--------|-----|
| UNAUTHORIZED | 401 | Check token, verify format |
| FORBIDDEN | 403 | Ensure user has admin role |
| VALIDATION_ERROR | 400 | Check field formats |
| SLUG_CONFLICT | 409 | Use different slug |
| USER_ALREADY_EXISTS | 409 | User already in company |
| COMPANY_NOT_FOUND | 404 | Verify company ID exists |

**See:** QUICK_REFERENCE.md → Common Issues or ENDPOINTS.md → Error Codes

## Request/Response Format

### All Success Responses
```json
{
  "success": true,
  "data": { /* resource */ },
  "timestamp": "ISO-8601"
}
```

### All Error Responses
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description",
    "details": { /* optional */ },
    "timestamp": "ISO-8601"
  }
}
```

**See:** ENDPOINTS.md → Error Handling or QUICK_REFERENCE.md → Request/Response Format

## File Structure

```
src/
├── types/
│   └── admin.ts                                # Validation schemas
├── lib/
│   └── admin/
│       ├── auth.ts                            # Auth middleware
│       └── database.ts                        # DB operations
└── app/api/admin/
    └── companies/
        ├── route.ts                           # POST/GET companies
        └── [companyId]/users/
            └── route.ts                       # POST/GET users

docs/
├── MASTER_ADMIN_INDEX.md                      # This file
├── MASTER_ADMIN_SUMMARY.md                    # Overview
├── MASTER_ADMIN_QUICK_REFERENCE.md            # Quick start
├── MASTER_ADMIN_ENDPOINTS.md                  # API docs
└── MASTER_ADMIN_IMPLEMENTATION_GUIDE.md       # Technical details
```

## Reading Path for Different Roles

### API Consumer (Using the API)
1. Quick Reference (10 min)
2. API Endpoints (20 min)
3. Refer back to Quick Reference for examples

### Backend Developer (Integrating)
1. Summary (5 min)
2. Implementation Guide (25 min)
3. API Endpoints (reference)
4. Code files themselves

### DevOps (Deploying)
1. Summary (5 min)
2. Implementation Guide → Database Schema (5 min)
3. Implementation Guide → Monitoring (5 min)

### QA (Testing)
1. Summary (5 min)
2. API Endpoints (20 min)
3. Quick Reference → Testing Checklist
4. Postman/Insomnia setup with examples

## Key Concepts

### Master Role
- Users with `admin` or `master` role can access endpoints
- Verified via JWT token signature
- Required for all admin operations

### CNPJ Format
- Brazilian business tax identification number
- Format: `XX.XXX.XXX/XXXX-XX` (exactly)
- Example: `12.345.678/0001-90`
- Must be unique per company

### Soft Deletes
- Records marked with `deleted_at` timestamp
- Not permanently removed
- Still visible with `deleted_at IS NULL` filter
- Preserves audit trail

### Company Plans
- `starter` - Basic plan
- `professional` - Mid-tier plan
- `enterprise` - Full-featured plan

### User Roles
- `owner` - Full company access
- `admin` - Administrative access
- `member` - Standard user
- `viewer` - Read-only access

## Integration Checklist

- [ ] Read SUMMARY.md for overview
- [ ] Run database migration (CNPJ column)
- [ ] Generate admin JWT token
- [ ] Test POST /companies endpoint
- [ ] Test GET /companies endpoint
- [ ] Test POST /companies/{id}/users endpoint
- [ ] Test GET /companies/{id}/users endpoint
- [ ] Verify error handling
- [ ] Integrate into admin dashboard
- [ ] Set up monitoring/logging
- [ ] Document in internal wiki

## Support References

**JWT Documentation:**
- RFC 7519: https://tools.ietf.org/html/rfc7519
- Auth guide: See JWT_SETUP_GUIDE.md in project

**Zod Validation:**
- Documentation: https://zod.dev
- Implementation: src/types/admin.ts

**Next.js Routes:**
- Documentation: https://nextjs.org/docs/app/building-your-application/routing
- Implementation: src/app/api/admin/

**Supabase:**
- Documentation: https://supabase.com/docs
- Implementation: src/lib/admin/database.ts

## FAQ

**Q: How do I generate an admin token?**
A: See QUICK_REFERENCE.md → Generate Admin Token section

**Q: What's the CNPJ format?**
A: Format is `XX.XXX.XXX/XXXX-XX` - See QUICK_REFERENCE.md → Common Issues

**Q: Can I update a company?**
A: Not yet. Update endpoint is planned for Phase 2. See IMPLEMENTATION_GUIDE.md → Future Enhancements

**Q: How do I filter results?**
A: Use query parameters. See ENDPOINTS.md → Query Parameters for each endpoint

**Q: What if I get a 403 error?**
A: Your token needs `admin` role. See QUICK_REFERENCE.md → Common Issues

**Q: Can I delete data?**
A: Soft deletes only. See IMPLEMENTATION_GUIDE.md → Database Schema Integration

**Q: Where do I test?**
A: See QUICK_REFERENCE.md → Testing Checklist

**Q: How do I paginate results?**
A: Use `limit` and `offset` query params. Max 100 per page. See ENDPOINTS.md

## Latest Updates

**Date:** August 13, 2026
**Version:** 1.0
**Status:** Production Ready

### What's Included
- ✅ 4 API endpoints
- ✅ Full authentication & authorization
- ✅ CNPJ validation
- ✅ Comprehensive documentation
- ✅ Database migration
- ✅ Error handling
- ✅ CORS support

### What's Coming
- 🔜 Update endpoints
- 🔜 Delete endpoints
- 🔜 Bulk import
- 🔜 Activity logs
- 🔜 API keys
- 🔜 Webhooks

## Document Maintenance

- **Documentation Version:** 1.0
- **Last Updated:** August 13, 2026
- **Maintained By:** Claude Code
- **Review Frequency:** Quarterly or as features change

---

**Start reading:** Choose your role above and follow the reading path, or use the Quick Links at the top!
