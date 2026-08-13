# User Management Endpoints Implementation Summary

## Overview

TypeScript route handlers for admin user management with complete role-based access control (RBAC).

## Files Created

### 1. API Route Handlers

#### `/src/app/api/admin/users/route.ts`
- **GET** - List all users in company
- Supports filtering by role, status, and search
- Pagination support (limit, offset)
- Requires admin or owner role

**Key Features:**
- Token validation with JWT verification
- Company affiliation check
- Role-based access control enforcement
- Query parameter validation
- Consistent error responses

#### `/src/app/api/admin/users/[id]/route.ts`
- **PUT** - Change user role
- **DELETE** - Remove user from company
- Both require admin or owner role

**Key Features:**
- User hierarchy protection (can't demote last owner)
- Audit logging for all changes
- Permission validation for role changes
- Soft delete implementation
- IP address and user agent tracking

### 2. RBAC Module

#### `/src/lib/rbac.ts`
Utility functions for role-based access control:

```typescript
// Role hierarchy
isRoleHierarchyValid(actorRole, targetRole) -> boolean
getRoleLevel(role) -> 1-4
compareRoles(role1, role2) -> -1|0|1

// Permission checking
hasPermission(role, permission) -> boolean
getPermissionsForRole(role) -> string[]

// User management
canManageUser(actorRole, targetRole) -> boolean
canChangeRole(actorRole, targetRole, newRole) -> boolean
canDeleteUser(actorRole, targetRole, isSameUser) -> boolean
isManagementRole(role) -> boolean

// Validation
isValidRole(role) -> boolean
isValidStatus(status) -> boolean
getAllRoles() -> UserRole[]
getAllStatuses() -> UserStatus[]

// Display
getRoleDisplayName(role) -> string
getRoleDescription(role) -> string
```

## Architecture

### Security Layers

```
HTTP Request
    ↓
[CORS/Rate Limiting]
    ↓
Extract Token from Header
    ↓
Verify JWT Token Signature
    ↓
Check Token Expiration
    ↓
Fetch User from Database
    ↓
Verify User is Active
    ↓
Get User's Company ID
    ↓
Check User's Role
    ↓
[Role-Based Access Control]
    ↓
Validate Request Body (Zod)
    ↓
Fetch Target User
    ↓
Verify Target in Same Company
    ↓
Check Permission to Modify Target
    ↓
Execute Database Operation
    ↓
Log to Audit Trail
    ↓
Return Response
```

### Role Hierarchy

```
Owner (Level 4)
  ├─ Can manage: All users
  └─ Can perform: All operations

Admin (Level 3)
  ├─ Can manage: Admin, Member, Viewer
  └─ Cannot manage: Owner users

Member (Level 2)
  ├─ Can manage: None
  └─ Can access: Own resources

Viewer (Level 1)
  └─ Can access: Shared resources (read-only)
```

## API Endpoints

### 1. List Users
```
GET /api/admin/users
  Query: role?, status?, search?, limit?, offset?
  Auth: Required (Bearer token)
  Required Role: admin | owner
  Returns: User list with pagination info
```

### 2. Change Role
```
PUT /api/admin/users/{id}/role
  Body: { role: "owner" | "admin" | "member" | "viewer" }
  Auth: Required (Bearer token)
  Required Role: admin | owner
  Returns: Updated user object
```

### 3. Remove User
```
DELETE /api/admin/users/{id}
  Auth: Required (Bearer token)
  Required Role: admin | owner
  Returns: Confirmation with user ID
```

## Request/Response Examples

### List Users
```bash
# Request
GET /api/admin/users?role=admin&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# Response 200
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "admin@example.com",
        "fullName": "Admin User",
        "displayName": "admin",
        "role": "admin",
        "status": "active",
        "emailVerified": true,
        "lastLoginAt": "2026-08-12T10:00:00Z",
        "createdAt": "2026-08-12T08:00:00Z",
        "updatedAt": "2026-08-12T09:00:00Z"
      }
    ],
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

### Change Role
```bash
# Request
PUT /api/admin/users/550e8400-e29b-41d4-a716-446655440000/role
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "role": "admin"
}

# Response 200
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "fullName": "User Name",
      "role": "admin",
      "status": "active",
      "updatedAt": "2026-08-12T10:05:00Z"
    }
  }
}
```

### Remove User
```bash
# Request
DELETE /api/admin/users/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# Response 200
{
  "success": true,
  "data": {
    "message": "User removed from company",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid authorization token",
    "timestamp": "2026-08-12T10:00:00Z"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only admin and owner users can manage users",
    "timestamp": "2026-08-12T10:00:00Z"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "timestamp": "2026-08-12T10:00:00Z"
  }
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "role": ["Invalid enum value"]
    },
    "timestamp": "2026-08-12T10:00:00Z"
  }
}
```

## Key Features

### 1. Authentication
- JWT token validation
- Token expiration checking
- User status verification
- Company affiliation validation

### 2. Authorization (RBAC)
- Owner can manage all users
- Admin can manage non-owner users
- Members cannot manage users
- Viewers cannot manage users

### 3. Data Integrity
- Last owner protection (prevents locking out company)
- Self-modification prevention
- Cross-company access prevention
- Soft deletes for data preservation

### 4. Audit Trail
- All changes logged to audit_logs table
- IP address and user agent captured
- Before/after values recorded
- Timestamp for every operation

### 5. Input Validation
- Zod schema validation
- UUID validation for IDs
- Enum validation for roles and statuses
- JSON parsing with error handling

### 6. Error Handling
- Consistent error format across endpoints
- Detailed validation error messages
- HTTP status codes per spec
- Development vs production error detail

## Security Best Practices Implemented

1. **Never Trust Client Input**
   - All inputs validated with Zod
   - Role/status checked against enums
   - UUIDs validated before DB queries

2. **Principle of Least Privilege**
   - Users can only manage users with lower roles
   - Admins cannot modify owners
   - Members cannot manage anyone

3. **Audit Everything**
   - All modifications logged with actor info
   - IP addresses captured
   - User agents recorded
   - Timestamps for compliance

4. **Protect Critical Data**
   - Soft deletes preserve data
   - Cannot delete yourself
   - Cannot remove last owner
   - All changes reversible (for admins)

5. **Secure Communication**
   - HTTPS required in production
   - Bearer token authentication
   - No sensitive data in URLs
   - CORS support for frontend apps

## Database Schema Dependencies

The implementation relies on these tables:

```sql
users (
  id UUID,
  company_id UUID,
  email VARCHAR,
  full_name VARCHAR,
  display_name VARCHAR,
  role user_role,
  status VARCHAR,
  email_verified BOOLEAN,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
)

audit_logs (
  id UUID,
  company_id UUID,
  user_id UUID,
  action VARCHAR,
  entity_type VARCHAR,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR,
  user_agent TEXT,
  created_at TIMESTAMP
)
```

## Usage in Next.js Application

### Protected Route Example
```typescript
import { GET, PUT, DELETE } from '@/app/api/admin/users/[id]/route';

// These routes automatically:
// 1. Verify JWT token
// 2. Check user role (admin/owner)
// 3. Validate request body
// 4. Check permissions
// 5. Log to audit trail
```

### Integration with Frontend
```typescript
// Use with React Query or SWR
const { data: users } = useQuery(
  ['users', filters],
  () => fetchUsers(accessToken, filters)
);

const updateUserRole = useMutation(
  (userId: string, role: string) =>
    fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role })
    })
);

const deleteUser = useMutation(
  (userId: string) =>
    fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
);
```

## Testing Checklist

- [ ] Owner can list users
- [ ] Admin can list users
- [ ] Member cannot list users
- [ ] Viewer cannot list users
- [ ] Owner can change any role
- [ ] Admin can change member/viewer role
- [ ] Admin cannot change owner role
- [ ] Cannot change your own role
- [ ] Cannot remove yourself
- [ ] Cannot remove last owner
- [ ] Changes are logged to audit_logs
- [ ] Invalid tokens are rejected
- [ ] Invalid roles are rejected
- [ ] Non-existent users return 404
- [ ] Cross-company access is prevented
- [ ] Soft delete sets deleted_at

## Performance Considerations

1. **Database Indexes**
   - idx_users_company_id (required for filtering)
   - idx_users_company_role (for role queries)
   - idx_users_company_email (for search)
   - idx_audit_logs_company_id (for logging)

2. **Query Optimization**
   - Use single query with filters
   - Pagination to prevent large result sets
   - Select only needed columns
   - Index on company_id for filtering

3. **Caching**
   - Cache user list with TTL
   - Invalidate on role change
   - Consider Redis for active users
   - Cache roles in JWT for frontend

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Monitoring and Logging

Key metrics to monitor:
- 401 errors (auth failures)
- 403 errors (permission denials)
- Role change frequency
- User deletion rate
- Large list queries
- Audit log growth

Alerts to set up:
- Multiple failed auth attempts
- Bulk user deletions
- Unusual role changes
- Suspicious IP addresses

## Future Enhancements

1. **Batch Operations**
   - Update multiple users at once
   - Batch role changes
   - Batch deletions with confirmation

2. **Soft Delete Recovery**
   - Restore deleted users
   - View deletion history
   - Permanent purge after X days

3. **Advanced Filtering**
   - Filter by last login date
   - Filter by creation date range
   - Filter by email domain

4. **Activity Tracking**
   - User login history
   - Permission change history
   - Deletion/restoration history

5. **Integrations**
   - Webhook notifications
   - Email alerts on role changes
   - Slack integration for audits
   - Export user list to CSV

---

## Conclusion

This implementation provides a production-ready user management system with:
- Complete role-based access control
- Comprehensive audit logging
- Input validation
- Error handling
- Security best practices
- TypeScript type safety
- Database integrity protection
