# IAeZap Authentication Documentation

Complete documentation for the IAeZap login endpoint and authentication system.

## Quick Navigation

### Getting Started (Start Here!)
1. **[Login Implementation Summary](./LOGIN_IMPLEMENTATION_SUMMARY.md)** (5 min read)
   - Overview of what was created
   - Checklist for setup
   - Key features and architecture

2. **[Quick Start Guide](./QUICK_START_LOGIN.md)** (10 min read)
   - Generate JWT keys
   - Create test user
   - Test the endpoint
   - Common troubleshooting

### Detailed Guides
3. **[Login Setup Guide](./LOGIN_SETUP.md)** (30 min read)
   - Complete setup instructions
   - Database schema requirements
   - Environment configuration
   - API endpoint documentation
   - Security considerations
   - Troubleshooting guide

4. **[Integration Guide](./LOGIN_INTEGRATION.md)** (45 min read)
   - Frontend integration (React hooks, components)
   - Backend integration (protected routes, middleware)
   - Token management strategies
   - Testing examples
   - Migration from other auth systems

## Reading Guide by Role

### For Frontend Developers
1. Start: [Quick Start Guide](./QUICK_START_LOGIN.md)
2. Then: [Integration Guide](./LOGIN_INTEGRATION.md) - React examples section
3. Reference: [Login Setup Guide](./LOGIN_SETUP.md) - API contract

### For Backend Developers
1. Start: [Quick Start Guide](./QUICK_START_LOGIN.md)
2. Then: [Integration Guide](./LOGIN_INTEGRATION.md) - Backend integration section
3. Deep Dive: [Login Setup Guide](./LOGIN_SETUP.md) - Everything

### For DevOps/Infrastructure
1. Start: [Login Implementation Summary](./LOGIN_IMPLEMENTATION_SUMMARY.md)
2. Then: [Login Setup Guide](./LOGIN_SETUP.md) - Environment setup section
3. Reference: [Database Migration](../supabase/migrations/create_users_table.sql)

### For Security Engineers
1. Start: [Login Setup Guide](./LOGIN_SETUP.md) - Security considerations
2. Then: [Login Implementation Summary](./LOGIN_IMPLEMENTATION_SUMMARY.md) - Security features
3. Deep Dive: [Integration Guide](./LOGIN_INTEGRATION.md) - Security best practices

## Document Overview

### [LOGIN_IMPLEMENTATION_SUMMARY.md](./LOGIN_IMPLEMENTATION_SUMMARY.md)
**Quick overview of the entire implementation**

Contains:
- What was created
- Files created/modified
- Implementation details
- Technology stack
- Setup checklist
- Configuration reference
- API endpoints
- Security features
- Next steps

**Best For**: Getting oriented, understanding the big picture, setup planning

---

### [QUICK_START_LOGIN.md](./QUICK_START_LOGIN.md)
**5-minute setup from zero to working endpoint**

Contains:
- Step-by-step setup (5 main steps)
- JWT key generation
- Database schema verification
- Test user creation
- Endpoint testing (cURL, JavaScript)
- Common error messages
- Token usage examples

**Best For**: Quick setup, first-time testing, debugging immediate issues

---

### [LOGIN_SETUP.md](./LOGIN_SETUP.md)
**Comprehensive setup and reference guide**

Contains:
- Prerequisites (database, environment)
- JWT key generation guide
- API endpoint documentation
- Request/response formats
- Error response codes
- Implementation details (4 sections)
- Client usage examples
- Token verification
- Password hashing
- Security considerations
- Troubleshooting guide

**Best For**: Complete setup, understanding every detail, production deployment

---

### [LOGIN_INTEGRATION.md](./LOGIN_INTEGRATION.md)
**Integration into frontend and backend applications**

Contains:
- API contract definition
- Frontend integration (React hooks, components)
- Backend integration (protected routes, middleware)
- Token refresh logic
- API client with token management
- Testing (unit and integration)
- Security best practices
- Migration guides
- Troubleshooting

**Best For**: Integrating with your app, writing client code, migrations

---

## Key Sections by Topic

### Setup & Configuration
- JWT Keys: [QUICK_START.md#step-1](./QUICK_START_LOGIN.md) → [LOGIN_SETUP.md#jwt-keys](./LOGIN_SETUP.md)
- Database: [LOGIN_SETUP.md#prerequisites](./LOGIN_SETUP.md) → [migrations/](../supabase/migrations/)
- Environment: [QUICK_START.md](./QUICK_START_LOGIN.md) → [LOGIN_SETUP.md#configuration](./LOGIN_SETUP.md)

### Testing & Debugging
- Test with cURL: [QUICK_START.md#step-5](./QUICK_START_LOGIN.md)
- Error messages: [QUICK_START.md#common-errors](./QUICK_START_LOGIN.md)
- Troubleshooting: [LOGIN_SETUP.md#troubleshooting](./LOGIN_SETUP.md)

### Frontend Integration
- React hooks: [LOGIN_INTEGRATION.md#react-example](./LOGIN_INTEGRATION.md)
- Forms: [LOGIN_INTEGRATION.md#login-form](./LOGIN_INTEGRATION.md)
- Token management: [LOGIN_INTEGRATION.md#using-tokens](./LOGIN_INTEGRATION.md)

### Backend Integration
- Protected routes: [LOGIN_INTEGRATION.md#protected-routes](./LOGIN_INTEGRATION.md)
- Middleware: [LOGIN_INTEGRATION.md#middleware](./LOGIN_INTEGRATION.md)
- Token verification: [LOGIN_SETUP.md#token-verification](./LOGIN_SETUP.md)

### Security
- Password security: [LOGIN_SETUP.md#password-storage](./LOGIN_SETUP.md)
- Token security: [LOGIN_SETUP.md#jwt-tokens](./LOGIN_SETUP.md)
- Best practices: [LOGIN_INTEGRATION.md#security-best-practices](./LOGIN_INTEGRATION.md)

## File Structure

```
docs/
├── README.md                           (This file - Navigation guide)
├── LOGIN_IMPLEMENTATION_SUMMARY.md     (Overview & checklist)
├── QUICK_START_LOGIN.md                (5-minute setup)
├── LOGIN_SETUP.md                      (Complete guide)
└── LOGIN_INTEGRATION.md                (Integration examples)

supabase/
└── migrations/
    └── create_users_table.sql          (Database schema)

scripts/
└── generate-jwt-keys.js                (JWT key generation)

src/app/api/auth/
└── login/
    └── route.ts                        (Endpoint implementation)
```

## Common Workflows

### Workflow 1: First-Time Setup
1. Read: [Implementation Summary](./LOGIN_IMPLEMENTATION_SUMMARY.md) (5 min)
2. Follow: [Quick Start Guide](./QUICK_START_LOGIN.md) (10 min)
3. Test: Make first login request
4. Reference: [Login Setup Guide](./LOGIN_SETUP.md) for details

### Workflow 2: Production Deployment
1. Review: [Security Considerations](./LOGIN_SETUP.md#security-considerations) (10 min)
2. Follow: [Environment Configuration](./LOGIN_SETUP.md#environment-variables) (15 min)
3. Test: Run full test suite
4. Deploy: With monitoring and logging

### Workflow 3: Frontend Integration
1. Understand: [API Contract](./LOGIN_INTEGRATION.md#api-contract) (5 min)
2. Implement: [React Hook](./LOGIN_INTEGRATION.md#react-example) (15 min)
3. Build: [Login Component](./LOGIN_INTEGRATION.md#login-form-component) (20 min)
4. Integrate: [API Client](./LOGIN_INTEGRATION.md#api-client) (10 min)

### Workflow 4: Backend Integration
1. Understand: [API Contract](./LOGIN_INTEGRATION.md#api-contract) (5 min)
2. Create: [Protected Routes](./LOGIN_INTEGRATION.md#protected-routes) (10 min)
3. Implement: [Middleware](./LOGIN_INTEGRATION.md#middleware) (15 min)
4. Test: [Integration Tests](./LOGIN_INTEGRATION.md#integration-tests) (20 min)

### Workflow 5: Troubleshooting
1. Check: [Common Errors](./QUICK_START_LOGIN.md#common-error-messages) (5 min)
2. Read: [Troubleshooting Guide](./LOGIN_SETUP.md#troubleshooting) (15 min)
3. Review: Relevant section in detailed guides
4. Debug: With error logs and database inspection

## Quick Reference

### Commands

```bash
# Generate JWT keys
npm run generate-jwt-keys

# Start development server
npm run dev

# Test endpoint with cURL
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Environment Variables

```bash
# Required
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional (defaults provided)
NODE_ENV=development
JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
ACCESS_TOKEN_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=604800
BCRYPT_ROUNDS=12
```

### API Endpoint

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "companyId": "optional-uuid"
}

Response: 200 OK
{
  "success": true,
  "access_token": "...",
  "refresh_token": "...",
  "user": {...},
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

## External Resources

### JWT/RS256
- [JWT.io - Interactive JWT debugger](https://jwt.io)
- [RFC 7519 - JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)

### Bcrypt
- [OWASP Password Hashing](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Bcrypt NPM Package](https://www.npmjs.com/package/bcrypt)

### Supabase
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase PostgreSQL Guide](https://supabase.com/docs/guides/database)

### Next.js
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Next.js Middleware](https://nextjs.org/docs/advanced-features/middleware)

## Help & Support

### Documentation Issues
Found a typo or confusing section? The docs are located in:
- `docs/` - Markdown documentation files

### Code Issues
- Check [LOGIN_SETUP.md#troubleshooting](./LOGIN_SETUP.md#troubleshooting)
- Review implementation in `src/app/api/auth/login/route.ts`

### Questions
1. Search relevant documentation file
2. Check [QUICK_START_LOGIN.md#common-error-messages](./QUICK_START_LOGIN.md#common-error-messages)
3. Review [LOGIN_SETUP.md#troubleshooting](./LOGIN_SETUP.md#troubleshooting)

---

## Summary

- **Start here**: [LOGIN_IMPLEMENTATION_SUMMARY.md](./LOGIN_IMPLEMENTATION_SUMMARY.md)
- **Quick setup**: [QUICK_START_LOGIN.md](./QUICK_START_LOGIN.md)
- **Complete guide**: [LOGIN_SETUP.md](./LOGIN_SETUP.md)
- **Integration**: [LOGIN_INTEGRATION.md](./LOGIN_INTEGRATION.md)

**Estimated Total Reading Time**: 90-120 minutes for complete understanding
**Estimated Setup Time**: 15-30 minutes from scratch

---

Last Updated: 2026-08-13
Version: 1.0.0
