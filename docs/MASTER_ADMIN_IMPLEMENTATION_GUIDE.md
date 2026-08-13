# Master Admin Endpoints - Implementation Guide

This guide explains the architecture and implementation of the master admin endpoints for IAeZap.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Application                       │
│              (Admin Dashboard / Service Account)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ JWT Token (role: 'admin')
                     │
        ┌────────────▼──────────────┐
        │  Authorization Header     │
        │  /api/admin/companies     │
        └────────────┬──────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │    Master Auth Middleware           │
        │  1. Extract token                   │
        │  2. Verify signature                │
        │  3. Check admin role                │
        │  4. Attach payload to request       │
        └────────────┬─────────────────────────┘
                     │
        ┌────────────▼──────────────────────┐
        │   Route Handler                   │
        │  - Validate request               │
        │  - Call database operations       │
        │  - Format response                │
        └────────────┬──────────────────────┘
                     │
        ┌────────────▼──────────────────────┐
        │   Database Operations             │
        │  - Execute queries                │
        │  - Handle errors                  │
        │  - Return results                 │
        └────────────┬──────────────────────┘
                     │
        ┌────────────▼──────────────────────┐
        │   Supabase PostgreSQL             │
        │  - companies table                │
        │  - users table                    │
        │  - audit_logs table               │
        └───────────────────────────────────┘
```

## Component Breakdown

### 1. Type Definitions (`src/types/admin.ts`)

**Purpose:** Validate and type all admin API operations

```typescript
// Validation schemas using Zod
createCompanySchema      // Request validation for POST /companies
addUserToCompanySchema   // Request validation for POST /users
companyResponseSchema    // Response type validation

// Inferred TypeScript types
CreateCompanyRequest     // TypeScript type for requests
AddUserToCompanyRequest
CompanyResponse
AdminApiResponse<T>      // Generic response type
```

**Key Features:**
- CNPJ format validation (XX.XXX.XXX/XXXX-XX)
- Email validation
- Role enum validation
- Plan validation
- Status codes constants
- Helper validation functions

### 2. Auth Middleware (`src/lib/admin/auth.ts`)

**Purpose:** Protect endpoints with master role authorization

```typescript
// Core functions
extractAndVerifyToken()     // Extract and decode JWT
isMasterUser()              // Check if user has admin/master role
withMasterAuth()            // Middleware wrapper for endpoints
formatErrorResponse()       // Standardize error responses
formatSuccessResponse()     // Standardize success responses
```

**How `withMasterAuth` Works:**

```
1. Extract token from:
   - Authorization: Bearer <token> header
   - Authorization cookie
   - access_token cookie
   - access_token query parameter

2. Verify token:
   - Check JWT signature using SUPABASE_SERVICE_ROLE_KEY
   - Verify not expired
   - Extract payload

3. Check authorization:
   - Look for 'admin' or 'master' role in payload
   - Return 403 if insufficient permissions

4. Call handler with payload
```

### 3. Database Operations (`src/lib/admin/database.ts`)

**Purpose:** Abstract database operations for companies and users

#### Company Operations

```typescript
companyOperations = {
  async create(ownerId, data)        // Create new company
  async getAll(filters)              // List companies with filters
  async getById(companyId)           // Get single company
  async update(companyId, updates)   // Update company
}
```

**Key Features:**
- Unique slug validation
- Soft delete support (deleted_at)
- Filter support (status, plan, owner)
- Pagination (limit/offset)
- Error handling with specific codes

#### User Operations

```typescript
userOperations = {
  async addToCompany(companyId, data)      // Add user to company
  async getCompanyUsers(companyId, filters) // List users in company
  async getUserById(companyId, userId)     // Get user by ID
  async updateUser(companyId, userId, updates) // Update user
  async removeFromCompany(companyId, userId) // Soft delete user
}
```

**Key Features:**
- Duplicate user validation
- Role-based assignment
- Status tracking
- Activity tracking (last_login_at)
- Soft delete support

### 4. Route Handlers

#### POST /api/admin/companies

```typescript
// File: src/app/api/admin/companies/route.ts

async handleCreateCompany(request, payload) {
  1. Parse JSON body
  2. Validate with createCompanySchema
  3. Call companyOperations.create()
  4. Handle errors (slug conflict, etc.)
  5. Return 201 with company data
}

// Wrapped with withMasterAuth
export const POST = withMasterAuth(handleCreateCompany);
```

**Request Flow:**
```
POST /api/admin/companies
{
  "name": "Company",
  "slug": "company",
  "cnpj": "12.345.678/0001-90"
}
    ↓
withMasterAuth middleware
    ↓
Verify token & admin role
    ↓
handleCreateCompany
    ↓
Validate schema
    ↓
Check slug uniqueness
    ↓
Insert into companies table
    ↓
201 Created response
```

#### GET /api/admin/companies

```typescript
async handleListCompanies(request) {
  1. Parse query parameters
  2. Build filter object
  3. Call companyOperations.getAll()
  4. Return 200 with company list
}

// Wrapped with withMasterAuth
export const GET = withMasterAuth(handleListCompanies);
```

**Query Support:**
```
status=active          → Filter by status
plan=professional      → Filter by plan
limit=50               → Results per page
offset=100             → Pagination offset
```

#### POST /api/admin/companies/{id}/users

```typescript
async handleAddUser(request, payload, { params }) {
  1. Validate company ID format (UUID)
  2. Verify company exists
  3. Parse and validate request body
  4. Call userOperations.addToCompany()
  5. Handle errors (user exists, invalid role, etc.)
  6. Return 201 with user data
}
```

**Route Parameters:**
```
{companyId} must be valid UUID
Example: 550e8400-e29b-41d4-a716-446655440000
```

#### GET /api/admin/companies/{id}/users

```typescript
async handleListUsers(request, payload, { params }) {
  1. Validate company ID format
  2. Verify company exists
  3. Parse query parameters
  4. Call userOperations.getCompanyUsers()
  5. Return 200 with users list
}
```

## Data Flow Examples

### Example 1: Create Company

```javascript
// 1. Client sends request
POST /api/admin/companies
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "cnpj": "12.345.678/0001-90",
  "plan": "professional"
}

// 2. withMasterAuth middleware
//    - Extracts token from Authorization header
//    - Verifies signature with SUPABASE_SERVICE_ROLE_KEY
//    - Checks payload.role === 'admin'
//    - If valid, attaches payload to request

// 3. handleCreateCompany
//    - Parses JSON body
//    - Validates with createCompanySchema (Zod)
//    - Calls companyOperations.create(payload.sub, data)

// 4. companyOperations.create
//    - Checks if slug already exists
//    - Inserts new row into companies table
//    - Returns created company with all fields

// 5. Response
201 Created
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "cnpj": "12.345.678/0001-90",
    "plan": "professional",
    "status": "active",
    "owner_id": "user-uuid",
    "created_at": "2026-08-13T10:00:00Z",
    "updated_at": "2026-08-13T10:00:00Z"
  },
  "timestamp": "2026-08-13T10:00:00Z"
}
```

### Example 2: Add User to Company

```javascript
// 1. Client sends request
POST /api/admin/companies/550e8400-e29b-41d4-a716-446655440000/users
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "email": "john@acme.com",
  "fullName": "John Doe",
  "role": "admin"
}

// 2. withMasterAuth + route params middleware
//    - Validates company ID format
//    - Verifies admin role

// 3. handleAddUser
//    - Checks company exists
//    - Validates request body
//    - Calls userOperations.addToCompany()

// 4. userOperations.addToCompany
//    - Checks user doesn't already exist in company
//    - Inserts new user record
//    - Associates with company_id
//    - Sets role to 'admin'

// 5. Response
201 Created
{
  "success": true,
  "data": {
    "id": "770a9622-g51d-63f6-c938-668887662222",
    "company_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@acme.com",
    "full_name": "John Doe",
    "role": "admin",
    "status": "active",
    "email_verified": false,
    "created_at": "2026-08-13T10:05:00Z",
    "updated_at": "2026-08-13T10:05:00Z"
  },
  "timestamp": "2026-08-13T10:05:00Z"
}
```

## Error Handling

### Authorization Errors

```javascript
// Missing token
401 Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization token",
    "timestamp": "2026-08-13T10:00:00Z"
  }
}

// Invalid role
403 Forbidden
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only master/admin users can access this endpoint",
    "timestamp": "2026-08-13T10:00:00Z"
  }
}
```

### Validation Errors

```javascript
// Invalid CNPJ format
400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "cnpj": "Invalid CNPJ format. Expected: XX.XXX.XXX/XXXX-XX"
    },
    "timestamp": "2026-08-13T10:00:00Z"
  }
}
```

### Business Logic Errors

```javascript
// Slug conflict
409 Conflict
{
  "success": false,
  "error": {
    "code": "SLUG_CONFLICT",
    "message": "Company slug already exists",
    "timestamp": "2026-08-13T10:00:00Z"
  }
}

// User exists
409 Conflict
{
  "success": false,
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "User already exists in this company",
    "timestamp": "2026-08-13T10:00:00Z"
  }
}
```

## Database Schema Integration

### Companies Table

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  cnpj VARCHAR(18) UNIQUE NOT NULL,      -- Added by migration
  description TEXT,
  plan VARCHAR(50) DEFAULT 'starter',
  status VARCHAR(50) DEFAULT 'active',
  owner_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_companies_cnpj ON companies(cnpj);
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_owner_id ON companies(owner_id);
CREATE INDEX idx_companies_status ON companies(status);
```

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  display_name VARCHAR(100),
  avatar_url TEXT,
  role user_role DEFAULT 'member',
  auth_id UUID UNIQUE,
  password_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  last_login_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  preferences JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  CONSTRAINT users_email_company_unique 
    UNIQUE (company_id, email)
);

-- Indexes
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company_email ON users(company_id, email);
```

## Integration with Existing Auth System

The master admin endpoints integrate with the existing JWT authentication:

```typescript
// Existing auth setup
const JWT_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Token generation (existing)
function generateAccessToken(userId, email, role) {
  return jwt.sign({
    sub: userId,
    email,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  }, JWT_SECRET);
}

// Master admin endpoints use same JWT verification
export async function POST(request) {
  const payload = verifyAccessToken(token);
  
  if (payload.role !== 'admin' && payload.role !== 'master') {
    return 403 Forbidden;
  }
  
  // Process admin request
}
```

## Environment Variables Required

```env
# Existing (used for JWT verification)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-secret-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NODE_ENV=production|development
```

## Testing Strategy

### Unit Tests (planned)

```typescript
// Test auth middleware
describe('Master Auth Middleware', () => {
  it('should reject requests without token', () => {});
  it('should reject invalid tokens', () => {});
  it('should reject non-admin users', () => {});
  it('should allow admin users', () => {});
});

// Test database operations
describe('Company Operations', () => {
  it('should create company with unique slug', () => {});
  it('should reject duplicate slugs', () => {});
  it('should list companies with filters', () => {});
});
```

### Integration Tests (planned)

```typescript
// End-to-end tests
describe('Master Admin API', () => {
  it('should create and list companies', () => {});
  it('should add users to company', () => {});
  it('should filter users by role', () => {});
});
```

## Security Considerations

### 1. Token Validation

- Signature verified with SUPABASE_SERVICE_ROLE_KEY
- Expiration checked
- Role claim validated

### 2. Input Validation

- All inputs validated with Zod schemas
- CNPJ format enforced
- Email format validated
- String length limits enforced

### 3. Database Security

- Soft deletes (preserved for auditing)
- Parameterized queries (via Supabase client)
- Proper indexes for query performance
- CNPJ uniqueness constraint

### 4. Error Handling

- Production doesn't leak sensitive details
- Development includes error context
- Consistent error response format
- Proper HTTP status codes

### 5. CORS Support

- OPTIONS preflight handlers
- Configurable origins
- Proper CORS headers

## Performance Considerations

### Indexes

```sql
-- Fast company lookups
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_cnpj ON companies(cnpj);
CREATE INDEX idx_companies_owner_id ON companies(owner_id);

-- Fast user queries
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_company_email ON users(company_id, email);
CREATE INDEX idx_users_company_role ON users(company_id, role);
```

### Pagination

- Limit: 10 (default), max 100 per request
- Offset-based pagination
- Order by created_at DESC for consistent results

### Query Optimization

- Soft delete filter (WHERE deleted_at IS NULL)
- Composite indexes for common queries
- Proper use of SELECT * vs specific columns (future)

## Monitoring & Logging

### Log Locations

```typescript
// Error logs
console.error('Create company endpoint error:', error);
console.error('Error creating company:', error);
console.error('Error fetching companies:', error);

// Recommended: Send to monitoring service
// - Sentry
// - DataDog
// - LogRocket
// - CloudWatch
```

### Metrics to Track

- Request count by endpoint
- Error rate by error code
- Response times
- Database query times
- Token validation failures
- Authorization failures

## Future Enhancements

### Phase 2

- [ ] Update company endpoint
- [ ] Delete company endpoint
- [ ] Update user endpoint
- [ ] Delete user endpoint
- [ ] Bulk user import (CSV)
- [ ] Activity audit logs

### Phase 3

- [ ] API keys for service-to-service
- [ ] Webhook support for events
- [ ] User invitation workflow
- [ ] Role permission customization
- [ ] Rate limiting
- [ ] Request logging

### Phase 4

- [ ] GraphQL API support
- [ ] Real-time updates (WebSocket)
- [ ] Advanced filtering and search
- [ ] Export to Excel/CSV
- [ ] Batch operations

## Troubleshooting

### Issue: 401 Unauthorized

**Check:**
1. Token present in Authorization header
2. Token format: `Bearer <token>`
3. Token signature valid (correct JWT_SECRET)
4. Token not expired

**Debug:**
```javascript
const decoded = jwt.decode(token);
console.log(decoded); // Check expiration, role
```

### Issue: 403 Forbidden

**Check:**
1. Token has `role: 'admin'` or `role: 'master'`
2. User actually has admin privileges
3. Not using user token (should use service role key)

**Fix:**
```javascript
// Use service role key for generating admin tokens
const adminToken = jwt.sign(payload, SUPABASE_SERVICE_ROLE_KEY);
```

### Issue: 400 Bad Request

**Check:**
1. Request body valid JSON
2. All required fields present
3. Field formats match validation rules
4. CNPJ format: XX.XXX.XXX/XXXX-XX
5. Slug lowercase + numbers + hyphens only

### Issue: 409 Conflict

**Check:**
1. Slug already exists → use different slug
2. User already in company → user already has access
3. CNPJ already used → check existing companies

## References

- JWT Spec: https://tools.ietf.org/html/rfc7519
- Zod Validation: https://zod.dev
- Next.js Routes: https://nextjs.org/docs/app/building-your-application/routing
- Supabase: https://supabase.com/docs
