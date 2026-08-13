# Admin User Management API

Complete TypeScript implementation of user management endpoints with role-based access control (RBAC).

## Overview

This document describes the admin user management API endpoints that allow companies to manage their users with proper role-based access control.

## Architecture

### File Structure

```
src/
├── app/api/admin/users/
│   ├── route.ts                 # GET - List users
│   └── [id]/
│       └── route.ts             # PUT/DELETE - Manage individual users
├── lib/
│   └── rbac.ts                  # RBAC utility functions
├── lib/auth/
│   ├── middleware.ts            # Authentication middleware
│   ├── tokens.ts                # JWT token handling
│   └── types.ts                 # Auth type definitions
└── types/
    └── auth.ts                  # API schemas and types
```

## Endpoints

### 1. GET /api/admin/users - List Users in Company

Lists all users in the authenticated user's company with filtering and pagination support.

#### Authentication

Required: Bearer token (JWT access token)

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `role` | string | - | Filter by role (owner, admin, member, viewer) |
| `status` | string | - | Filter by status (active, inactive, invited, suspended) |
| `search` | string | - | Search by email or name |
| `limit` | number | 50 | Results per page (max: 100) |
| `offset` | number | 0 | Pagination offset |

#### Required Permissions

- Must be authenticated
- Must have `admin` or `owner` role
- Can only see users in their own company

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "john.doe@example.com",
        "fullName": "John Doe",
        "displayName": "john.doe",
        "role": "admin",
        "status": "active",
        "emailVerified": true,
        "lastLoginAt": "2026-08-12T10:00:00Z",
        "createdAt": "2026-08-12T08:00:00Z",
        "updatedAt": "2026-08-12T09:00:00Z"
      }
    ],
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 401 | UNAUTHORIZED | Missing or invalid authorization token |
| 403 | FORBIDDEN | Only admin and owner users can manage users |
| 500 | INTERNAL_SERVER_ERROR | Failed to fetch users |

#### Examples

**List all users:**
```bash
curl -X GET "https://api.example.com/api/admin/users" \
  -H "Authorization: Bearer <access_token>"
```

**Filter by role:**
```bash
curl -X GET "https://api.example.com/api/admin/users?role=admin" \
  -H "Authorization: Bearer <access_token>"
```

**Search users:**
```bash
curl -X GET "https://api.example.com/api/admin/users?search=john&limit=20" \
  -H "Authorization: Bearer <access_token>"
```

**Pagination:**
```bash
curl -X GET "https://api.example.com/api/admin/users?limit=20&offset=20" \
  -H "Authorization: Bearer <access_token>"
```

---

### 2. PUT /api/admin/users/{id}/role - Change User Role

Changes a user's role within the company.

#### Authentication

Required: Bearer token (JWT access token)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | User ID to update |

#### Request Body

```json
{
  "role": "admin"
}
```

| Field | Type | Required | Enum Values | Description |
|-------|------|----------|-------------|-------------|
| `role` | string | Yes | owner, admin, member, viewer | New role for the user |

#### Required Permissions

- Must be authenticated
- Must have `admin` or `owner` role
- Cannot change your own role
- Admins cannot promote users to `owner`
- Admins cannot change owner roles
- Cannot demote the last owner

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.doe@example.com",
      "fullName": "John Doe",
      "role": "admin",
      "status": "active",
      "updatedAt": "2026-08-12T10:05:00Z"
    }
  }
}
```

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 400 | INVALID_REQUEST | Request body is not valid JSON |
| 400 | VALIDATION_ERROR | Invalid role provided |
| 401 | UNAUTHORIZED | Missing or invalid authorization token |
| 403 | FORBIDDEN | Insufficient permissions to change role |
| 404 | NOT_FOUND | User not found |
| 500 | INTERNAL_SERVER_ERROR | Failed to update user role |

#### Examples

**Promote user to admin:**
```bash
curl -X PUT "https://api.example.com/api/admin/users/550e8400-e29b-41d4-a716-446655440000/role" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

**Demote user to member:**
```bash
curl -X PUT "https://api.example.com/api/admin/users/550e8400-e29b-41d4-a716-446655440000/role" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "member"}'
```

#### Role Hierarchy

Users can only manage users with a lower or equal role:

- **Owner** can manage: owner, admin, member, viewer
- **Admin** can manage: admin, member, viewer (NOT owner)
- **Member** cannot manage: anyone
- **Viewer** cannot manage: anyone

---

### 3. DELETE /api/admin/users/{id} - Remove User from Company

Soft deletes a user from the company (sets deleted_at timestamp and status to inactive).

#### Authentication

Required: Bearer token (JWT access token)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | User ID to remove |

#### Required Permissions

- Must be authenticated
- Must have `admin` or `owner` role
- Cannot delete yourself
- Cannot delete owner as admin
- Cannot delete the last owner

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "message": "User removed from company",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 401 | UNAUTHORIZED | Missing or invalid authorization token |
| 403 | FORBIDDEN | Cannot delete user (insufficient permissions or invalid operation) |
| 404 | NOT_FOUND | User not found |
| 500 | INTERNAL_SERVER_ERROR | Failed to remove user |

#### Examples

**Remove a user:**
```bash
curl -X DELETE "https://api.example.com/api/admin/users/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <access_token>"
```

#### Important Notes

- This is a **soft delete** - the user record is marked as deleted but not permanently removed
- User data is preserved for audit and compliance purposes
- User status is set to `inactive` and `deleted_at` timestamp is recorded
- Deleted users cannot log in
- User can be restored by clearing the `deleted_at` field and resetting status (requires database admin access)

---

## Role-Based Access Control (RBAC)

### Role Definitions

#### Owner
- **Access Level**: 4 (Highest)
- **Capabilities**:
  - Full access to all company features
  - Manage users and roles
  - Manage company settings
  - Manage billing
  - View audit logs
  - Cannot be demoted if last owner

#### Admin
- **Access Level**: 3
- **Capabilities**:
  - Manage non-owner users
  - Change member and viewer roles
  - Manage company settings
  - View audit logs
  - Cannot promote users to owner
  - Cannot manage other admins or owners

#### Member
- **Access Level**: 2
- **Capabilities**:
  - Access company resources
  - Edit own profile
  - View shared resources
  - Cannot manage users

#### Viewer
- **Access Level**: 1 (Lowest)
- **Capabilities**:
  - Read-only access to shared resources
  - View own profile
  - Cannot manage anything

### Permission Matrix

|Permission|Owner|Admin|Member|Viewer|
|----------|-----|-----|------|------|
|Read users|✓|✓|✓|✓|
|Write users|✓|✓|-|-|
|Delete users|✓|✓|-|-|
|Manage roles|✓|✓*|-|-|
|Manage settings|✓|✓|-|-|
|View audit logs|✓|✓|-|-|

*Admin can only manage non-owner users

### RBAC Utility Functions

The `src/lib/rbac.ts` module provides utility functions for RBAC operations:

```typescript
import {
  isRoleHierarchyValid,
  hasPermission,
  canManageUser,
  canChangeRole,
  canDeleteUser,
  isManagementRole,
  getRoleLevel,
  compareRoles,
  isValidRole,
  getAllRoles,
} from '@/lib/rbac';

// Check if one role can manage another
if (canManageUser('admin', 'member')) {
  // Do something
}

// Check specific permissions
if (hasPermission('admin', 'manage:roles')) {
  // Admin can manage roles
}

// Get role hierarchy level
const ownerLevel = getRoleLevel('owner'); // 4
const memberLevel = getRoleLevel('member'); // 2

// Validate role strings
if (isValidRole('admin')) {
  // Valid role
}
```

---

## Audit Logging

All user management operations are automatically logged to the `audit_logs` table with the following information:

- **Action**: ROLE_CHANGED, USER_DELETED, USER_CREATED, etc.
- **Entity Type**: 'user'
- **Entity ID**: ID of the user affected
- **Actor**: User ID who performed the action
- **Company**: Company ID where action occurred
- **Changes**: Old and new values (JSON)
- **IP Address**: Client IP address
- **User Agent**: Client user agent string
- **Timestamp**: When the action occurred

### Audit Log Example

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "action": "ROLE_CHANGED",
  "entity_type": "user",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "old_values": {"role": "member"},
  "new_values": {"role": "admin"},
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2026-08-12T10:05:00Z"
}
```

---

## Security Considerations

### Input Validation

All inputs are validated using Zod schemas:
- JWT tokens are verified and validated
- User IDs are validated as UUIDs
- Roles are validated against allowed enum values
- Request bodies are strictly validated

### Rate Limiting

Consider implementing rate limiting on these endpoints:
- GET /api/admin/users: 100 requests/minute per user
- PUT /api/admin/users/{id}/role: 50 requests/minute per user
- DELETE /api/admin/users/{id}: 20 requests/minute per user

### Data Protection

- Passwords are never returned in API responses
- Soft deletes preserve data for compliance
- All modifications are logged to audit trail
- IP addresses and user agents are captured

### Permission Enforcement

- Every request requires valid JWT token
- User's company affiliation is verified
- User's role is checked against operation requirements
- Cross-company access is prevented
- Last owner protection prevents company lockout

---

## Implementation Details

### Authentication Flow

```
1. Client sends request with Bearer token
2. extractTokenFromRequest() retrieves token from Authorization header
3. verifyAccessToken() validates JWT signature and expiration
4. Token payload (user ID, email, role) is extracted
5. User's current role and company are fetched from database
6. Role-based access control is enforced
```

### Database Transactions

- User updates are atomic
- Audit logs are created after successful updates
- If user record doesn't exist in company, operation fails
- Soft deletes set both deleted_at and status fields

### Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2026-08-12T10:00:00Z"
  }
}
```

---

## Client Implementation Examples

### JavaScript/TypeScript

```typescript
// Get all users
const response = await fetch('/api/admin/users', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const data = await response.json();
console.log(data.data.users);

// Change user role
const updateResponse = await fetch(
  `/api/admin/users/${userId}/role`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'admin' })
  }
);

// Delete user
const deleteResponse = await fetch(
  `/api/admin/users/${userId}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);
```

### React Hook (Custom Hook)

```typescript
function useAdminUsers(accessToken: string) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async (filters?: {
    role?: string;
    status?: string;
    search?: string;
  }) => {
    setLoading(true);
    const params = new URLSearchParams(filters);
    const response = await fetch(
      `/api/admin/users?${params}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const data = await response.json();
    setUsers(data.data.users);
    setLoading(false);
  }, [accessToken]);

  const updateUserRole = useCallback(async (userId: string, role: string) => {
    const response = await fetch(
      `/api/admin/users/${userId}/role`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role })
      }
    );
    return response.json();
  }, [accessToken]);

  const deleteUser = useCallback(async (userId: string) => {
    const response = await fetch(
      `/api/admin/users/${userId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    return response.json();
  }, [accessToken]);

  return { users, loading, fetchUsers, updateUserRole, deleteUser };
}
```

---

## Testing

### Unit Tests Example

```typescript
import { canManageUser, canChangeRole, canDeleteUser } from '@/lib/rbac';

describe('RBAC Functions', () => {
  it('owner should manage anyone', () => {
    expect(canManageUser('owner', 'member')).toBe(true);
    expect(canManageUser('owner', 'admin')).toBe(true);
  });

  it('admin should not manage owner', () => {
    expect(canManageUser('admin', 'owner')).toBe(false);
  });

  it('admin can change member to admin', () => {
    expect(canChangeRole('admin', 'member', 'admin')).toBe(true);
  });

  it('admin cannot promote to owner', () => {
    expect(canChangeRole('admin', 'member', 'owner')).toBe(false);
  });
});
```

---

## API Rate Limits

Recommended rate limits per minute per authenticated user:

| Endpoint | Limit | Window |
|----------|-------|--------|
| GET /api/admin/users | 100 | 1 minute |
| PUT /api/admin/users/{id}/role | 50 | 1 minute |
| DELETE /api/admin/users/{id} | 20 | 1 minute |

---

## Troubleshooting

### 401 Unauthorized

- Verify token is valid and not expired
- Check Authorization header format: `Bearer <token>`
- Ensure token is from same authentication service

### 403 Forbidden

- Verify user has admin or owner role
- Check user is not suspended
- Verify not trying to modify yourself or owner as admin

### 404 Not Found

- Verify user ID is correct UUID
- Verify user exists in your company
- Check user hasn't been deleted

### 500 Internal Server Error

- Check database connectivity
- Verify Supabase environment variables
- Check server logs for detailed error message

---

## Migration from Existing Systems

If migrating user roles from an existing system:

1. Export existing users and their roles
2. Create users in database with correct role assignments
3. Test RBAC enforcement with sample users
4. Gradually migrate users in your application
5. Verify audit logs capture all operations

---

## Future Enhancements

Potential improvements to the user management system:

- Batch operations (update multiple users)
- Scheduled deletions (users can be recovered within X days)
- Role templates (pre-defined role sets)
- Permission delegation (allowing members to perform admin actions)
- Team/department management
- Invite system with email verification
- Single sign-on (SSO) integration
- Multi-factor authentication (MFA) enforcement
