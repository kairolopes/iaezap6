# User Management API - Quick Start Guide

## Testing the Endpoints Locally

### Prerequisites

1. Next.js development server running
2. Valid JWT access token
3. Users created in the database
4. Company setup with users

### Get an Access Token

```bash
# Login to get tokens
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123",
    "rememberMe": true
  }'

# Response includes:
{
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}

# Save the accessToken for subsequent requests
TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

## Testing with cURL

### 1. List All Users

```bash
# Basic list
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN"

# With role filter
curl -X GET "http://localhost:3000/api/admin/users?role=admin" \
  -H "Authorization: Bearer $TOKEN"

# With status filter
curl -X GET "http://localhost:3000/api/admin/users?status=active" \
  -H "Authorization: Bearer $TOKEN"

# Search by email
curl -X GET "http://localhost:3000/api/admin/users?search=john" \
  -H "Authorization: Bearer $TOKEN"

# Pagination
curl -X GET "http://localhost:3000/api/admin/users?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"

# Combined filters
curl -X GET "http://localhost:3000/api/admin/users?role=member&status=active&search=user&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Change User Role

```bash
# Get a user ID first from list endpoint
USER_ID="550e8400-e29b-41d4-a716-446655440000"

# Promote to admin
curl -X PUT http://localhost:3000/api/admin/users/$USER_ID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'

# Demote to member
curl -X PUT http://localhost:3000/api/admin/users/$USER_ID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "member"}'

# Change to viewer
curl -X PUT http://localhost:3000/api/admin/users/$USER_ID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "viewer"}'
```

### 3. Remove User

```bash
USER_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X DELETE http://localhost:3000/api/admin/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN"
```

## Testing with Postman

### Setup

1. **Create Environment Variables**
   - `base_url`: `http://localhost:3000`
   - `token`: (leave empty, set after login)

2. **Create Login Request**
   - Method: POST
   - URL: `{{base_url}}/api/auth/login`
   - Body (JSON):
   ```json
   {
     "email": "admin@example.com",
     "password": "password123"
   }
   ```
   - Tests tab (to auto-save token):
   ```javascript
   var jsonData = pm.response.json();
   pm.environment.set("token", jsonData.tokens.accessToken);
   ```

### Requests

#### List Users
```
GET {{base_url}}/api/admin/users
Headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json

Query Params (optional):
  role: admin
  status: active
  search: john
  limit: 50
  offset: 0
```

#### Change Role
```
PUT {{base_url}}/api/admin/users/{{userId}}/role
Headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json

Body (JSON):
{
  "role": "admin"
}
```

#### Remove User
```
DELETE {{base_url}}/api/admin/users/{{userId}}
Headers:
  Authorization: Bearer {{token}}
```

## Testing with TypeScript/JavaScript

### Setup

```typescript
// config.ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const headers = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
});
```

### Usage

```typescript
import { API_URL, headers } from './config';

// List users
async function listUsers(token: string, filters?: {
  role?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.role) params.append('role', filters.role);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.offset) params.append('offset', String(filters.offset));

  const response = await fetch(
    `${API_URL}/api/admin/users?${params}`,
    { headers: headers(token) }
  );
  return response.json();
}

// Change role
async function updateUserRole(
  token: string,
  userId: string,
  newRole: 'admin' | 'member' | 'viewer'
) {
  const response = await fetch(
    `${API_URL}/api/admin/users/${userId}/role`,
    {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({ role: newRole }),
    }
  );
  return response.json();
}

// Delete user
async function deleteUser(token: string, userId: string) {
  const response = await fetch(
    `${API_URL}/api/admin/users/${userId}`,
    {
      method: 'DELETE',
      headers: headers(token),
    }
  );
  return response.json();
}

// Usage
const token = 'your_access_token_here';

// List all users
const users = await listUsers(token);
console.log(users.data.users);

// List admins only
const admins = await listUsers(token, { role: 'admin' });

// Update role
const updated = await updateUserRole(token, 'user-id', 'admin');

// Delete user
const deleted = await deleteUser(token, 'user-id');
```

## Error Scenarios to Test

### 1. Authorization Errors

```bash
# Missing token
curl -X GET http://localhost:3000/api/admin/users
# Expected: 401 UNAUTHORIZED

# Invalid token
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer invalid_token"
# Expected: 401 UNAUTHORIZED

# Expired token
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer expired_token"
# Expected: 401 UNAUTHORIZED
```

### 2. Permission Errors

```bash
# Member trying to list users
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer member_token"
# Expected: 403 FORBIDDEN

# Admin trying to change owner role
curl -X PUT http://localhost:3000/api/admin/users/$OWNER_ID/role \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{"role": "member"}'
# Expected: 403 FORBIDDEN

# Admin trying to delete owner
curl -X DELETE http://localhost:3000/api/admin/users/$OWNER_ID \
  -H "Authorization: Bearer admin_token"
# Expected: 403 FORBIDDEN
```

### 3. Validation Errors

```bash
# Invalid role
curl -X PUT http://localhost:3000/api/admin/users/$USER_ID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "invalid_role"}'
# Expected: 400 VALIDATION_ERROR

# Invalid JSON
curl -X PUT http://localhost:3000/api/admin/users/$USER_ID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d 'not json'
# Expected: 400 INVALID_REQUEST
```

### 4. Not Found Errors

```bash
# Non-existent user
curl -X PUT http://localhost:3000/api/admin/users/00000000-0000-0000-0000-000000000000/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
# Expected: 404 NOT_FOUND
```

### 5. Business Logic Errors

```bash
# Try to delete yourself
curl -X DELETE http://localhost:3000/api/admin/users/$YOUR_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: 403 FORBIDDEN

# Try to change your own role
curl -X PUT http://localhost:3000/api/admin/users/$YOUR_ID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "member"}'
# Expected: 403 FORBIDDEN

# Try to demote last owner
curl -X PUT http://localhost:3000/api/admin/users/$OWNER_ID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
# Expected: 403 FORBIDDEN (if only one owner exists)
```

## Database Verification

### Check Audit Logs

```sql
-- View all user management changes
SELECT * FROM audit_logs
WHERE entity_type = 'user'
  AND company_id = 'your-company-id'
  AND action IN ('ROLE_CHANGED', 'USER_DELETED')
ORDER BY created_at DESC
LIMIT 20;

-- View changes for specific user
SELECT * FROM audit_logs
WHERE entity_id = 'user-id'
ORDER BY created_at DESC;

-- Check who changed what
SELECT
  al.action,
  u.email as actor,
  al.old_values,
  al.new_values,
  al.created_at,
  al.ip_address
FROM audit_logs al
JOIN users u ON u.id = al.user_id
WHERE al.company_id = 'your-company-id'
ORDER BY al.created_at DESC;
```

### Verify User Data

```sql
-- Check user roles in company
SELECT id, email, full_name, role, status, deleted_at
FROM users
WHERE company_id = 'your-company-id'
ORDER BY created_at DESC;

-- Check for soft-deleted users
SELECT id, email, role, deleted_at
FROM users
WHERE company_id = 'your-company-id'
  AND deleted_at IS NOT NULL;

-- Count users by role
SELECT role, COUNT(*) as count, status
FROM users
WHERE company_id = 'your-company-id'
  AND deleted_at IS NULL
GROUP BY role, status;
```

## Performance Testing

### Load Test Script

```bash
#!/bin/bash

TOKEN="your_token_here"
CONCURRENT_REQUESTS=10
TOTAL_REQUESTS=100

echo "Starting load test..."

for i in $(seq 1 $TOTAL_REQUESTS); do
  (
    curl -s -X GET "http://localhost:3000/api/admin/users?limit=50" \
      -H "Authorization: Bearer $TOKEN" > /dev/null
    echo "Request $i completed"
  ) &
  
  if [ $((i % CONCURRENT_REQUESTS)) -eq 0 ]; then
    wait
    echo "Batch $((i / CONCURRENT_REQUESTS)) completed"
  fi
done

wait
echo "Load test completed"
```

## Integration Testing

### Jest Test Suite

```typescript
describe('Admin User Management API', () => {
  let accessToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Login and get token
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'password123'
      })
    });
    const data = await response.json();
    accessToken = data.tokens.accessToken;
  });

  describe('GET /api/admin/users', () => {
    it('should list users', async () => {
      const response = await fetch('http://localhost:3000/api/admin/users', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.users)).toBe(true);
    });
  });

  describe('PUT /api/admin/users/{id}/role', () => {
    it('should change user role', async () => {
      const response = await fetch(
        `http://localhost:3000/api/admin/users/${testUserId}/role`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role: 'admin' })
        }
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.role).toBe('admin');
    });
  });

  describe('DELETE /api/admin/users/{id}', () => {
    it('should delete user', async () => {
      const response = await fetch(
        `http://localhost:3000/api/admin/users/${testUserId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});
```

## Debugging Tips

### Enable Debug Logging

```typescript
// In your API routes, add console logs:
console.log('Token payload:', payload);
console.log('Current user role:', currentUserData.role);
console.log('Target user role:', targetUserData.role);
console.log('Permission check result:', canManageUser(actor, target));
```

### Check Network Requests

1. Open DevTools (F12)
2. Go to Network tab
3. Make API requests
4. Check request headers and response body

### View Audit Logs

```sql
-- Real-time audit log view
SELECT *
FROM audit_logs
WHERE company_id = 'your-company-id'
ORDER BY created_at DESC
LIMIT 50;
```

## Common Issues and Solutions

### Issue: 401 Unauthorized
**Solution:**
- Verify token is not expired
- Check token format (Bearer prefix)
- Re-login to get new token
- Verify token secret in env vars

### Issue: 403 Forbidden
**Solution:**
- Check user role is admin or owner
- Verify not trying to modify yourself
- Check target user role (can't modify owners as admin)
- Verify users are in same company

### Issue: 404 Not Found
**Solution:**
- Verify user ID is correct UUID format
- Check user exists in database
- Verify user not already deleted
- Check user is in your company

### Issue: Slow Response Times
**Solution:**
- Check database connection
- Review Supabase performance metrics
- Add indexes on company_id if missing
- Reduce limit parameter if large
- Check for long-running transactions

## Next Steps

1. Integrate into your frontend application
2. Add form validation on client side
3. Implement proper error handling UI
4. Add loading states and spinners
5. Implement caching for user lists
6. Add real-time updates with websockets
7. Set up monitoring and alerts
8. Create user management dashboard
