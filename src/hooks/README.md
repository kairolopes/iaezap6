# Custom React Hooks for Admin API Calls

This directory contains custom React hooks for managing API calls to the admin endpoints. All hooks include built-in loading, error, and success states.

## Installation & Usage

Import hooks directly from this directory:

```typescript
import { useCompanies, useUsers, useCreateCompany } from '@/hooks';
```

## Available Hooks

### useCompanies()

Fetch a list of companies with optional filtering.

**Requirements:** Authentication with admin/master role

**Returns:**
- `data: CompanyResponse[] | null` - Array of company objects
- `loading: boolean` - Loading state
- `error: string | null` - Error message if any
- `success: boolean` - Whether the last operation succeeded
- `fetchCompanies(options?: UseCompaniesOptions)` - Function to fetch companies

**Options:**
```typescript
interface UseCompaniesOptions {
  status?: 'active' | 'paused' | 'suspended' | 'cancelled';
  plan?: 'starter' | 'professional' | 'enterprise';
  limit?: number;
  offset?: number;
}
```

**Example:**
```typescript
import { useCompanies } from '@/hooks';
import { useEffect } from 'react';

export function CompanyList() {
  const { data, loading, error, fetchCompanies } = useCompanies();

  useEffect(() => {
    fetchCompanies({ status: 'active', limit: 20 });
  }, [fetchCompanies]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {data?.map(company => (
        <li key={company.id}>{company.name}</li>
      ))}
    </ul>
  );
}
```

---

### useUsers()

Fetch users from the authenticated user's company.

**Requirements:** Authentication with admin role

**Returns:**
- `data: UserInCompanyResponse[] | null` - Array of user objects
- `total: number | null` - Total number of users
- `limit: number` - Current page limit
- `offset: number` - Current page offset
- `loading: boolean` - Loading state
- `error: string | null` - Error message if any
- `success: boolean` - Whether the last operation succeeded
- `fetchUsers(options?: UseUsersOptions)` - Function to fetch users

**Options:**
```typescript
interface UseUsersOptions {
  role?: 'admin' | 'supervisor' | 'operador';
  status?: 'active' | 'inactive' | 'invited' | 'suspended';
  search?: string;
  limit?: number;
  offset?: number;
}
```

**Example:**
```typescript
import { useUsers } from '@/hooks';
import { useEffect, useState } from 'react';

export function UserList() {
  const { data, total, loading, error, fetchUsers } = useUsers();
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchUsers({ limit: 50, offset: page * 50 });
  }, [page, fetchUsers]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div>Total users: {total}</div>
      <ul>
        {data?.map(user => (
          <li key={user.id}>{user.email}</li>
        ))}
      </ul>
      <button onClick={() => setPage(page - 1)}>Previous</button>
      <button onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}
```

---

### useCreateCompany()

Create a new company.

**Requirements:** Authentication with admin/master role

**Returns:**
- `data: CompanyResponse | null` - Created company object
- `loading: boolean` - Loading state
- `error: string | null` - Error message if any
- `success: boolean` - Whether the operation succeeded
- `createCompany(data: CreateCompanyRequest)` - Function to create a company
- `reset()` - Function to reset state

**Example:**
```typescript
import { useCreateCompany } from '@/hooks';
import { useState } from 'react';

export function CreateCompanyForm() {
  const { loading, error, success, createCompany, reset } = useCreateCompany();
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    cnpj: '',
    plan: 'starter' as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createCompany(formData);
  };

  if (success) {
    return (
      <div>
        <p>Company created successfully!</p>
        <button onClick={reset}>Create Another</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Company Name"
      />
      <input
        type="text"
        value={formData.slug}
        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
        placeholder="Slug (lowercase, hyphens only)"
      />
      <input
        type="text"
        value={formData.cnpj}
        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
        placeholder="CNPJ (XX.XXX.XXX/XXXX-XX)"
      />
      <select
        value={formData.plan}
        onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
      >
        <option value="starter">Starter</option>
        <option value="professional">Professional</option>
        <option value="enterprise">Enterprise</option>
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Company'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

---

### useCreateUser()

Create a new user in the authenticated user's company.

**Requirements:** Authentication with admin role

**Returns:**
- `data: UserInCompanyResponse | null` - Created user object
- `loading: boolean` - Loading state
- `error: string | null` - Error message if any
- `success: boolean` - Whether the operation succeeded
- `createUser(data: AddUserToCompanyRequest)` - Function to create a user
- `reset()` - Function to reset state

**Example:**
```typescript
import { useCreateUser } from '@/hooks';
import { useState } from 'react';

export function CreateUserForm() {
  const { loading, error, success, createUser, reset } = useCreateUser();
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    role: 'operador' as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createUser(formData);
  };

  if (success) {
    return (
      <div>
        <p>User created successfully!</p>
        <button onClick={reset}>Add Another User</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="Email"
        required
      />
      <input
        type="text"
        value={formData.fullName}
        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
        placeholder="Full Name (optional)"
      />
      <select
        value={formData.role}
        onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
      >
        <option value="operador">Operator</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create User'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

---

### useUpdateUserRole()

Update a user's role.

**Requirements:** Authentication with admin role

**Returns:**
- `data: UserInCompanyResponse | null` - Updated user object
- `loading: boolean` - Loading state
- `error: string | null` - Error message if any
- `success: boolean` - Whether the operation succeeded
- `updateRole(userId: string, newRole: UserRole)` - Function to update role
- `reset()` - Function to reset state

**Example:**
```typescript
import { useUpdateUserRole } from '@/hooks';
import { useState } from 'react';

export function UserRoleSelector({ userId, currentRole }: { userId: string; currentRole: string }) {
  const { loading, error, updateRole } = useUpdateUserRole();
  const [role, setRole] = useState(currentRole);

  const handleChange = async (newRole: string) => {
    setRole(newRole);
    await updateRole(userId, newRole as any);
  };

  return (
    <div>
      <select value={role} onChange={(e) => handleChange(e.target.value)} disabled={loading}>
        <option value="operador">Operator</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Admin</option>
      </select>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

---

### useDeleteUser()

Delete (soft delete) a user from the company.

**Requirements:** Authentication with admin role

**Returns:**
- `deletedUserId: string | null` - ID of the deleted user
- `loading: boolean` - Loading state
- `error: string | null` - Error message if any
- `success: boolean` - Whether the operation succeeded
- `deleteUser(userId: string)` - Function to delete a user
- `reset()` - Function to reset state

**Example:**
```typescript
import { useDeleteUser } from '@/hooks';

export function DeleteUserButton({ userId }: { userId: string }) {
  const { loading, error, success, deleteUser } = useDeleteUser();

  const handleDelete = async () => {
    if (confirm('Are you sure you want to remove this user?')) {
      await deleteUser(userId);
    }
  };

  if (success) {
    return <p>User removed successfully</p>;
  }

  return (
    <div>
      <button onClick={handleDelete} disabled={loading}>
        {loading ? 'Removing...' : 'Remove User'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

---

## Common Patterns

### Form with Validation

```typescript
import { useCreateUser } from '@/hooks';
import { useState } from 'react';

export function UserForm() {
  const { loading, error, success, createUser, reset } = useCreateUser();
  const [formError, setFormError] = useState<string | null>(null);

  const validateForm = (data: any) => {
    if (!data.email) return 'Email is required';
    if (!data.email.includes('@')) return 'Invalid email format';
    if (data.fullName && data.fullName.length < 2) return 'Name must be at least 2 characters';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    const validationError = validateForm(data);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    await createUser(data as any);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      {formError && <p style={{ color: 'orange' }}>{formError}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        Submit
      </button>
    </form>
  );
}
```

### Loading & Error States

```typescript
export function Component() {
  const { data, loading, error } = useCompanies();

  return (
    <div>
      {loading && <div className="spinner" />}
      {error && <div className="error-banner">{error}</div>}
      {!loading && !error && data?.length === 0 && <div>No companies found</div>}
      {!loading && !error && data && data.length > 0 && (
        <div>
          {data.map(item => (
            <div key={item.id}>{item.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Type Definitions

All hooks use types from `@/types/admin`:

```typescript
export type CompanyResponse = {
  id: string;
  name: string;
  slug: string;
  cnpj: string;
  description?: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'paused' | 'suspended' | 'cancelled';
  ownerId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type UserInCompanyResponse = {
  id: string;
  email: string;
  fullName?: string;
  displayName?: string;
  role: 'admin' | 'supervisor' | 'operador';
  status: 'active' | 'inactive' | 'invited' | 'suspended';
  emailVerified: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCompanyRequest = {
  name: string;
  slug: string;
  cnpj: string;
  description?: string;
  plan?: 'starter' | 'professional' | 'enterprise';
  metadata?: Record<string, unknown>;
};

export type AddUserToCompanyRequest = {
  email: string;
  fullName?: string;
  role?: 'admin' | 'supervisor' | 'operador';
};
```

---

## Error Handling

All hooks provide detailed error messages:

- **Validation errors** include field-specific details
- **Authorization errors** indicate insufficient permissions
- **Network errors** are caught and displayed
- **Server errors** return the server's error message

Example error handling:

```typescript
const { error, createUser } = useCreateUser();

try {
  await createUser(data);
} catch (err) {
  console.error('Failed to create user:', error);
}
```

---

## Notes

- All hooks require authentication (Bearer token in Authorization header)
- The hooks automatically manage loading, error, and success states
- Use the `reset()` function to clear state after operations
- Pagination is handled through `limit` and `offset` options
- Search and filter options are passed through the API query parameters
- All timestamps are in ISO 8601 format
