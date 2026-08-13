# Master Admin Endpoints - Quick Reference

## Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/admin/companies` | Create company | Master |
| GET | `/api/admin/companies` | List companies | Master |
| POST | `/api/admin/companies/{id}/users` | Add user to company | Master |
| GET | `/api/admin/companies/{id}/users` | List company users | Master |

## Quick Setup

### 1. Update Database Schema

Run the migration to add CNPJ support:

```sql
-- Run this in your Supabase SQL editor
-- File: src/lib/auth/002_add_cnpj_to_companies.sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18) UNIQUE NOT NULL DEFAULT '';
```

### 2. Generate Admin Token

```javascript
const jwt = require('jsonwebtoken');

const adminToken = jwt.sign(
  {
    sub: 'your-user-id',
    email: 'admin@example.com',
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { algorithm: 'HS256' }
);

console.log('Bearer ' + adminToken);
```

## Curl Examples

### Create Company

```bash
curl -X POST http://localhost:3000/api/admin/companies \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Company Name",
    "slug": "company-slug",
    "cnpj": "12.345.678/0001-90",
    "plan": "starter"
  }'
```

### List Companies

```bash
curl http://localhost:3000/api/admin/companies \
  -H "Authorization: Bearer TOKEN"
```

### Add User to Company

```bash
curl -X POST http://localhost:3000/api/admin/companies/{COMPANY_ID}/users \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "member"
  }'
```

### List Company Users

```bash
curl http://localhost:3000/api/admin/companies/{COMPANY_ID}/users \
  -H "Authorization: Bearer TOKEN"
```

## JavaScript/TypeScript Client

```typescript
const BASE_URL = 'http://localhost:3000/api/admin';

const adminClient = {
  async createCompany(token: string, data: any) {
    const response = await fetch(`${BASE_URL}/companies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async listCompanies(token: string, filters?: any) {
    const params = new URLSearchParams(filters);
    const response = await fetch(
      `${BASE_URL}/companies?${params}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  },

  async addUserToCompany(token: string, companyId: string, data: any) {
    const response = await fetch(
      `${BASE_URL}/companies/${companyId}/users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    );
    return response.json();
  },

  async listCompanyUsers(token: string, companyId: string, filters?: any) {
    const params = new URLSearchParams(filters);
    const response = await fetch(
      `${BASE_URL}/companies/${companyId}/users?${params}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  }
};

// Usage
const token = 'your-admin-token';

// Create company
const company = await adminClient.createCompany(token, {
  name: 'Acme Corp',
  slug: 'acme-corp',
  cnpj: '12.345.678/0001-90'
});

// List companies
const companies = await adminClient.listCompanies(token, {
  status: 'active',
  limit: 10
});

// Add user
const user = await adminClient.addUserToCompany(token, company.data.id, {
  email: 'user@acme.com',
  fullName: 'John Doe',
  role: 'member'
});

// List users
const users = await adminClient.listCompanyUsers(token, company.data.id);
```

## Request/Response Format

### Success Response (201/200)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "...",
    "...": "..."
  },
  "timestamp": "2026-08-13T10:00:00Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {
      "field": "error message"
    },
    "timestamp": "2026-08-13T10:00:00Z"
  }
}
```

## Validation Rules

### Company

| Field | Rules |
|-------|-------|
| name | 2-255 chars, required |
| slug | 2-100 chars, lowercase+numbers+hyphens, unique, required |
| cnpj | Format: XX.XXX.XXX/XXXX-XX, unique, required |
| plan | `starter` \| `professional` \| `enterprise` |

### User

| Field | Rules |
|-------|-------|
| email | Valid email, required |
| fullName | 2-255 chars, optional |
| role | `owner` \| `admin` \| `member` (default) \| `viewer` |

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Server Error |

## Files Created

```
src/
├── types/admin.ts                          (Type definitions)
├── lib/admin/
│   ├── auth.ts                             (Auth middleware)
│   └── database.ts                         (DB operations)
└── app/api/admin/
    └── companies/
        ├── route.ts                        (POST/GET companies)
        └── [companyId]/users/
            └── route.ts                    (POST/GET users)

docs/
├── MASTER_ADMIN_ENDPOINTS.md              (Full documentation)
└── MASTER_ADMIN_QUICK_REFERENCE.md        (This file)

migrations/
└── 002_add_cnpj_to_companies.sql          (Database migration)
```

## Database Schema Changes

### New Column: companies.cnpj

```sql
ALTER TABLE companies ADD COLUMN cnpj VARCHAR(18) UNIQUE NOT NULL;
```

### New Indexes

- `idx_companies_cnpj` - Fast CNPJ lookups
- `idx_companies_owner_id_active` - Find companies by owner
- `idx_companies_status_created_at` - Common listing queries

### New Constraints

- CNPJ format validation trigger
- Unique constraint on CNPJ field

## Common Issues

### Issue: "Only master/admin users can access this endpoint"

**Solution:** Ensure token has `role: 'admin'` or `role: 'master'`

```javascript
// Check token payload
const payload = jwt.verify(token, secret);
console.log(payload.role); // Should be 'admin' or 'master'
```

### Issue: "Company slug already exists"

**Solution:** Use unique slug for each company

```javascript
const slug = 'company-name-' + Date.now();
// Or use a slugify library
const slug = require('slugify')(name, { lower: true });
```

### Issue: "User already exists in this company"

**Solution:** Check if user exists before adding

```bash
# List users first
curl "http://localhost:3000/api/admin/companies/{ID}/users?email=user@example.com"
```

### Issue: "Invalid CNPJ format"

**Solution:** Use correct format: XX.XXX.XXX/XXXX-XX

```javascript
// Valid: 12.345.678/0001-90
// Invalid: 12345678000190
```

## Testing Checklist

- [ ] Generate admin token with correct role
- [ ] Test create company endpoint
- [ ] Verify company appears in list
- [ ] Test add user to company
- [ ] Verify user appears in company users list
- [ ] Test invalid tokens (401)
- [ ] Test non-admin users (403)
- [ ] Test duplicate slugs (409)
- [ ] Test missing required fields (400)
- [ ] Test invalid CNPJ format (400)

## Next Steps

1. Run database migration to add CNPJ column
2. Generate admin token
3. Test endpoints with curl or Postman
4. Integrate into admin dashboard
5. Add webhook notifications (future)
6. Implement audit logging (future)
