# Master Admin Management Endpoints

This document describes the master admin endpoints for managing companies and users in IAeZap's multi-tenant system.

## Overview

The master admin endpoints provide privileged operations for creating and managing companies and their users. These endpoints are protected by role-based authorization and require a valid JWT token with the `admin` or `master` role.

## Authentication & Authorization

### Requirements

All admin endpoints require:
1. Valid JWT token in the `Authorization` header
2. Token must have `admin` or `master` role
3. Token signature must be valid

### Token Sources

Tokens can be provided via:
1. `Authorization: Bearer <token>` header (recommended)
2. `Authorization` cookie
3. `access_token` cookie
4. `access_token` query parameter (not recommended)

### Authorization Check

Master authorization is verified by the `withMasterAuth` middleware which:
1. Extracts token from request
2. Verifies token signature using JWT_SECRET
3. Checks for `admin` or `master` role in token
4. Attaches decoded payload to handler for use

```typescript
// User with master role
{
  "sub": "user-id-uuid",
  "role": "admin", // or "master"
  "email": "admin@example.com",
  "iat": 1692000000,
  "exp": 1692003600
}
```

## Endpoints

### 1. Create Company

**Endpoint:** `POST /api/admin/companies`

Create a new company with CNPJ.

#### Request

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "cnpj": "12.345.678/0001-90",
  "description": "Leading provider of innovative solutions",
  "plan": "professional",
  "metadata": {
    "industry": "technology",
    "country": "BR"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Company name (2-255 characters) |
| slug | string | Yes | URL-friendly identifier (2-100 chars, lowercase, alphanumeric + hyphens, must be unique) |
| cnpj | string | Yes | Brazilian business tax ID (format: XX.XXX.XXX/XXXX-XX) |
| description | string | No | Company description (max 1000 chars) |
| plan | string | No | Plan level: `starter` (default), `professional`, `enterprise` |
| metadata | object | No | Additional metadata (optional) |

#### Response

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "cnpj": "12.345.678/0001-90",
    "description": "Leading provider of innovative solutions",
    "plan": "professional",
    "status": "active",
    "owner_id": "user-id-uuid",
    "metadata": {
      "industry": "technology",
      "country": "BR"
    },
    "created_at": "2026-08-13T10:30:00Z",
    "updated_at": "2026-08-13T10:30:00Z"
  },
  "timestamp": "2026-08-13T10:30:00Z"
}
```

**Errors:**

| Status | Code | Message |
|--------|------|---------|
| 400 | VALIDATION_ERROR | Invalid request data |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Not master/admin user |
| 409 | SLUG_CONFLICT | Slug already exists |
| 500 | INTERNAL_SERVER_ERROR | Server error |

---

### 2. List Companies

**Endpoint:** `GET /api/admin/companies`

List all companies with optional filtering and pagination.

#### Request

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: `active`, `paused`, `suspended`, `cancelled` |
| plan | string | Filter by plan: `starter`, `professional`, `enterprise` |
| limit | number | Results per page (default: 10, max: 100) |
| offset | number | Number of results to skip (default: 0) |

**Examples:**
```
GET /api/admin/companies
GET /api/admin/companies?status=active&plan=professional
GET /api/admin/companies?limit=50&offset=100
```

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Corporation",
      "slug": "acme-corp",
      "cnpj": "12.345.678/0001-90",
      "description": "Leading provider of innovative solutions",
      "plan": "professional",
      "status": "active",
      "owner_id": "user-id-uuid",
      "metadata": {},
      "created_at": "2026-08-13T10:30:00Z",
      "updated_at": "2026-08-13T10:30:00Z"
    },
    {
      "id": "660f9511-f40c-52e5-b827-557766551111",
      "name": "Global Industries",
      "slug": "global-industries",
      "cnpj": "98.765.432/0001-01",
      "plan": "starter",
      "status": "active",
      "owner_id": "another-user-uuid",
      "metadata": {},
      "created_at": "2026-08-12T14:20:00Z",
      "updated_at": "2026-08-12T14:20:00Z"
    }
  ],
  "timestamp": "2026-08-13T10:35:00Z"
}
```

**Errors:**

| Status | Code | Message |
|--------|------|---------|
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Not master/admin user |
| 500 | INTERNAL_SERVER_ERROR | Server error |

---

### 3. Add User to Company

**Endpoint:** `POST /api/admin/companies/{companyId}/users`

Add a user to a company with a specific role.

#### Request

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| companyId | string | UUID of the company |

**Body:**
```json
{
  "email": "john.doe@acme.com",
  "fullName": "John Doe",
  "role": "admin"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email address |
| fullName | string | No | User's full name (2-255 chars) |
| role | string | No | User role: `owner`, `admin`, `member` (default), `viewer` |

#### Response

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "770a9622-g51d-63f6-c938-668887662222",
    "company_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@acme.com",
    "full_name": "John Doe",
    "display_name": null,
    "role": "admin",
    "status": "active",
    "email_verified": false,
    "last_login_at": null,
    "created_at": "2026-08-13T10:40:00Z",
    "updated_at": "2026-08-13T10:40:00Z"
  },
  "timestamp": "2026-08-13T10:40:00Z"
}
```

**Errors:**

| Status | Code | Message |
|--------|------|---------|
| 400 | VALIDATION_ERROR | Invalid request data |
| 400 | INVALID_COMPANY_ID | Company ID is not a valid UUID |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Not master/admin user |
| 404 | COMPANY_NOT_FOUND | Company does not exist |
| 409 | USER_ALREADY_EXISTS | User already exists in company |
| 500 | INTERNAL_SERVER_ERROR | Server error |

---

### 4. List Company Users

**Endpoint:** `GET /api/admin/companies/{companyId}/users`

List all users in a company with optional filtering.

#### Request

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| companyId | string | UUID of the company |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| role | string | Filter by role: `owner`, `admin`, `member`, `viewer` |
| status | string | Filter by status: `active`, `inactive`, `invited`, `suspended` |
| limit | number | Results per page (default: 10, max: 100) |
| offset | number | Number of results to skip (default: 0) |

**Examples:**
```
GET /api/admin/companies/550e8400-e29b-41d4-a716-446655440000/users
GET /api/admin/companies/550e8400-e29b-41d4-a716-446655440000/users?role=admin
GET /api/admin/companies/550e8400-e29b-41d4-a716-446655440000/users?status=active&limit=50
```

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "770a9622-g51d-63f6-c938-668887662222",
      "company_id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.doe@acme.com",
      "full_name": "John Doe",
      "display_name": null,
      "role": "admin",
      "status": "active",
      "email_verified": false,
      "last_login_at": "2026-08-13T09:00:00Z",
      "created_at": "2026-08-13T10:40:00Z",
      "updated_at": "2026-08-13T10:40:00Z"
    },
    {
      "id": "880b0733-h62e-74g7-d049-779998773333",
      "company_id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "jane.smith@acme.com",
      "full_name": "Jane Smith",
      "display_name": "Jane",
      "role": "member",
      "status": "active",
      "email_verified": true,
      "last_login_at": "2026-08-13T08:30:00Z",
      "created_at": "2026-08-12T15:20:00Z",
      "updated_at": "2026-08-12T15:20:00Z"
    }
  ],
  "timestamp": "2026-08-13T10:45:00Z"
}
```

**Errors:**

| Status | Code | Message |
|--------|------|---------|
| 400 | INVALID_COMPANY_ID | Company ID is not a valid UUID |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Not master/admin user |
| 404 | COMPANY_NOT_FOUND | Company does not exist |
| 500 | INTERNAL_SERVER_ERROR | Server error |

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "error description",
      "another_field": "another error"
    },
    "timestamp": "2026-08-13T10:50:00Z"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions (not master/admin) |
| VALIDATION_ERROR | 400 | Invalid request data |
| INVALID_COMPANY_ID | 400 | Company ID format invalid |
| COMPANY_NOT_FOUND | 404 | Company does not exist |
| SLUG_CONFLICT | 409 | Slug already in use |
| USER_ALREADY_EXISTS | 409 | User already in company |
| INTERNAL_SERVER_ERROR | 500 | Server-side error |

---

## Usage Examples

### Create a Company

```bash
curl -X POST http://localhost:3000/api/admin/companies \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech Startup Inc",
    "slug": "tech-startup",
    "cnpj": "11.222.333/0001-81",
    "description": "Innovative technology company",
    "plan": "professional"
  }'
```

### List All Companies

```bash
curl -X GET "http://localhost:3000/api/admin/companies?status=active&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Add a User to Company

```bash
curl -X POST http://localhost:3000/api/admin/companies/550e8400-e29b-41d4-a716-446655440000/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@techstartup.com",
    "fullName": "Alex Developer",
    "role": "member"
  }'
```

### List Company Users

```bash
curl -X GET "http://localhost:3000/api/admin/companies/550e8400-e29b-41d4-a716-446655440000/users?role=admin" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Implementation Notes

### File Structure

```
src/
├── app/
│   └── api/
│       └── admin/
│           └── companies/
│               ├── route.ts                    # POST/GET companies
│               └── [companyId]/
│                   └── users/
│                       └── route.ts            # POST/GET users in company
├── lib/
│   └── admin/
│       ├── auth.ts                            # Master auth middleware
│       └── database.ts                        # Database operations
└── types/
    └── admin.ts                               # Type definitions
```

### Key Components

1. **`withMasterAuth` Middleware**: Wraps endpoints to enforce master role
2. **`companyOperations`**: Database CRUD for companies
3. **`userOperations`**: Database CRUD for users within companies
4. **Validation Schemas**: Zod schemas for request validation

### Database Requirements

- `companies` table with `cnpj` column
- `users` table for company members
- Soft delete support (deleted_at field)
- Proper indexes for performance

---

## Security Considerations

1. **Token Validation**: All tokens are validated before access
2. **Role Authorization**: Only `admin` or `master` roles can access
3. **Soft Deletes**: Records are soft-deleted, not permanently removed
4. **Error Messages**: Production doesn't leak sensitive details
5. **CORS**: Proper CORS headers for cross-origin requests
6. **Input Validation**: All inputs validated with Zod schemas
7. **CNPJ Format**: CNPJ format validated on database level

---

## Testing

### Test Token Generation

```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    sub: 'user-uuid',
    email: 'admin@example.com',
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  'your-jwt-secret',
  { algorithm: 'HS256' }
);

console.log('Bearer ' + token);
```

### Example Test Cases

1. Create company with valid data → 201
2. Create company with duplicate slug → 409
3. Create company without token → 401
4. Create company with user role → 403
5. List companies with filters → 200
6. Add user without company → 404
7. Add existing user → 409

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding:
- Per-IP rate limits
- Per-user rate limits
- Token bucket or sliding window algorithms

---

## Future Enhancements

1. Update/Delete company endpoints
2. Update/Delete user endpoints
3. Bulk import users
4. Company activity audit logs
5. Role-based permissions matrix
6. API key support for service-to-service
7. Webhook notifications for events
8. User invitation workflow with email
