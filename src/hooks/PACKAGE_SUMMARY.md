# Custom React Hooks Package - Summary

Complete TypeScript React custom hooks for admin API calls with integrated loading, error, and success state management.

## Package Contents

### Core Hooks

All hooks are located in `src/hooks/` and provide complete state management for API operations.

#### 1. **useCompanies.ts**
- Fetches a list of companies
- Supports filtering by status and plan
- Includes pagination with limit/offset
- **Returns**: `{ data, loading, error, success, fetchCompanies }`

#### 2. **useUsers.ts**
- Fetches users from authenticated user's company
- Supports filtering by role, status, and search term
- Includes pagination
- **Returns**: `{ data, total, limit, offset, loading, error, success, fetchUsers }`

#### 3. **useCreateCompany.ts**
- Creates a new company
- Validates company data (name, slug, CNPJ, plan)
- Includes error details for validation failures
- **Returns**: `{ data, loading, error, success, createCompany, reset }`

#### 4. **useCreateUser.ts**
- Creates a new user in authenticated user's company
- Validates email, fullName, and role
- Supports default role assignment
- **Returns**: `{ data, loading, error, success, createUser, reset }`

#### 5. **useUpdateUserRole.ts**
- Updates a user's role within the company
- Prevents invalid role transitions (e.g., last owner demotion)
- Validates user permissions
- **Returns**: `{ data, loading, error, success, updateRole, reset }`

#### 6. **useDeleteUser.ts**
- Soft deletes a user from the company (sets deleted_at and status to inactive)
- Prevents self-deletion
- Prevents removing last owner
- **Returns**: `{ deletedUserId, loading, error, success, deleteUser, reset }`

### Utility Files

#### 7. **api.utils.ts**
Provides utility functions for API requests:
- `apiRequest<T>()` - Base fetch wrapper
- `apiGet()`, `apiPost()`, `apiPut()`, `apiDelete()` - HTTP method helpers
- `buildQueryString()` - Query parameter builder
- `parseValidationErrors()` - Error parser
- `formatErrorMessage()` - Error formatter
- `isValidationError()`, `isAuthError()`, `isNetworkError()` - Error type checkers
- `apiRequestWithRetry()` - Exponential backoff retry logic

#### 8. **types.ts**
TypeScript type definitions:
- Hook state types (BaseHookState, DataHookState, ListHookState)
- Hook options types (CompanyFilterOptions, UserFilterOptions)
- Type aliases (UserRole, CompanyPlan, CompanyStatus, UserStatus)
- API response wrapper types
- Re-exports from `@/types/admin`

#### 9. **index.ts**
Barrel export file for easy imports:
```typescript
import { useCompanies, useUsers, useCreateCompany, useCreateUser, useUpdateUserRole, useDeleteUser } from '@/hooks';
```

### Documentation

#### 10. **README.md**
Complete documentation including:
- Installation and usage instructions
- Detailed hook API documentation
- Code examples for each hook
- Common patterns and best practices
- Type definitions reference

#### 11. **EXAMPLES.md**
Comprehensive real-world examples:
- Basic usage for each hook
- Advanced patterns (filtering, pagination, search)
- Form implementations
- Modal dialogs
- Batch operations
- Optimistic updates
- Error handling with toast notifications

#### 12. **PACKAGE_SUMMARY.md**
This file - quick reference guide

---

## Quick Start

### Installation

All files are already in `src/hooks/` directory. No additional dependencies required beyond React.

### Basic Usage

```typescript
import { useCompanies, useUsers, useCreateCompany } from '@/hooks';

// In your component
const { data: companies, loading, error, fetchCompanies } = useCompanies();

// Fetch data on mount
useEffect(() => {
  fetchCompanies({ status: 'active' });
}, [fetchCompanies]);

// Use the data
if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error}</div>;
return <div>{companies?.length} companies</div>;
```

---

## Key Features

### State Management
- **loading**: Indicates if a request is in progress
- **error**: Contains error message if request fails
- **success**: Indicates if the last operation succeeded
- **data**: Contains the response data (when successful)

### Type Safety
- Full TypeScript support
- Exported types for all request/response data
- Validation error parsing with field-level details

### Error Handling
- Network errors caught and formatted
- Validation errors with field-specific messages
- Authorization/permission errors clearly indicated
- Detailed error messages with optional details

### Built-in Features
- Query parameter handling
- Pagination support
- Search and filtering
- Retry logic with exponential backoff (via api.utils)
- Optimistic updates (application level)
- Request deduplication (application level)

---

## Type Reference

### Companies
```typescript
type CompanyPlan = 'starter' | 'professional' | 'enterprise';
type CompanyStatus = 'active' | 'paused' | 'suspended' | 'cancelled';

interface CompanyResponse {
  id: string;
  name: string;
  slug: string;
  cnpj: string;
  description?: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  ownerId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface CreateCompanyRequest {
  name: string;           // 2-255 chars
  slug: string;           // 2-100 chars, lowercase + hyphens
  cnpj: string;           // Format: XX.XXX.XXX/XXXX-XX
  description?: string;   // 0-1000 chars
  plan?: CompanyPlan;     // default: 'starter'
  metadata?: Record<string, unknown>;
}
```

### Users
```typescript
type UserRole = 'admin' | 'supervisor' | 'operador';
type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

interface UserInCompanyResponse {
  id: string;
  email: string;
  fullName?: string;
  displayName?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AddUserToCompanyRequest {
  email: string;           // Valid email format
  fullName?: string;       // 2-255 chars
  role?: UserRole;         // default: 'operador'
}
```

---

## API Endpoints

All hooks call the following endpoints:

| Hook | Method | Endpoint | Auth Required |
|------|--------|----------|---------------|
| useCompanies | GET | `/api/admin/companies` | Admin/Master |
| useUsers | GET | `/api/admin/users` | Admin |
| useCreateCompany | POST | `/api/admin/companies` | Admin/Master |
| useCreateUser | POST | `/api/admin/users` | Admin |
| useUpdateUserRole | PUT | `/api/admin/users/{id}/role` | Admin |
| useDeleteUser | DELETE | `/api/admin/users/{id}` | Admin |

---

## Error Handling Examples

### Validation Errors
```typescript
// API returns:
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: {
      email: ['Invalid email format'],
      name: ['Must be at least 2 characters']
    }
  }
}

// Hook error will contain formatted message
```

### Authorization Errors
```typescript
// Returns 401/403 with:
{
  success: false,
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN',
    message: 'Missing authorization token' | 'Only admin users can...'
  }
}
```

### Network Errors
```typescript
// Caught by api.utils, returns:
{
  success: false,
  error: {
    code: 'NETWORK_ERROR',
    message: 'Network request failed'
  }
}
```

---

## Best Practices

1. **Always check loading state** before rendering data
2. **Display error messages** to users clearly
3. **Use reset()** after successful operations in forms
4. **Implement debouncing** for search/filter operations
5. **Handle race conditions** with AbortSignal or dependency tracking
6. **Validate data locally** before sending to API
7. **Provide user feedback** during long operations
8. **Log errors** for debugging in development

---

## Browser Support

Works in all modern browsers that support:
- ES2020+
- Fetch API
- React 16.8+ (hooks)
- TypeScript 4.0+

---

## File Structure

```
src/hooks/
├── index.ts                    # Barrel exports
├── types.ts                    # TypeScript types
├── api.utils.ts               # API utility functions
├── useCompanies.ts            # Fetch companies hook
├── useUsers.ts                # Fetch users hook
├── useCreateCompany.ts        # Create company hook
├── useCreateUser.ts           # Create user hook
├── useUpdateUserRole.ts       # Update user role hook
├── useDeleteUser.ts           # Delete user hook
├── README.md                  # Full documentation
├── EXAMPLES.md                # Code examples
└── PACKAGE_SUMMARY.md         # This file
```

---

## Performance Considerations

### Optimization Tips
1. **Memoize callbacks** with useCallback to prevent unnecessary re-renders
2. **Use React.memo** for components that frequently receive the same props
3. **Implement pagination** to avoid loading too many records at once
4. **Debounce search** inputs to reduce API calls
5. **Cache responses** locally if needed (not built-in)

### Known Limitations
- No built-in caching (implement at component level)
- No request cancellation (implement with AbortController if needed)
- No automatic polling (implement with setInterval if needed)
- No request deduplication (implement at component level)

---

## Contributing

When adding new hooks:
1. Follow the existing pattern (state + callback function)
2. Include all three states: loading, error, success
3. Add JSDoc comments with examples
4. Export from index.ts
5. Add type definitions to types.ts
6. Document in README.md and EXAMPLES.md
7. Maintain TypeScript strictness

---

## License

Same as the main project.

---

## Questions or Issues?

Refer to:
1. README.md for detailed documentation
2. EXAMPLES.md for code examples
3. types.ts for type definitions
4. api.utils.ts for low-level API handling
