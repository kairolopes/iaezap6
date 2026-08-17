# Custom Hooks Examples

Complete examples demonstrating how to use each custom hook in real components.

## Table of Contents

1. [useCompanies](#usecompanies-examples)
2. [useUsers](#useusers-examples)
3. [useCreateCompany](#usecreatcompany-examples)
4. [useCreateUser](#usecreatuser-examples)
5. [useUpdateUserRole](#useupdateserrole-examples)
6. [useDeleteUser](#usedeleteuser-examples)
7. [Advanced Patterns](#advanced-patterns)

---

## useCompanies Examples

### Basic List

```typescript
import { useCompanies } from '@/hooks';
import { useEffect } from 'react';

export function BasicCompanyList() {
  const { data, loading, error, fetchCompanies } = useCompanies();

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  if (loading) return <div>Loading companies...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Companies</h2>
      {data?.length === 0 ? (
        <p>No companies found</p>
      ) : (
        <ul>
          {data?.map((company) => (
            <li key={company.id}>
              <h3>{company.name}</h3>
              <p>Plan: {company.plan}</p>
              <p>Status: {company.status}</p>
              <p>CNPJ: {company.cnpj}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### With Filters

```typescript
import { useCompanies } from '@/hooks';
import { useEffect, useState } from 'react';

export function FilteredCompanyList() {
  const { data, loading, error, fetchCompanies } = useCompanies();
  const [filters, setFilters] = useState({
    status: 'active' as const,
    plan: 'professional' as const,
  });

  useEffect(() => {
    fetchCompanies(filters);
  }, [filters, fetchCompanies]);

  return (
    <div>
      <div>
        <label>
          Status:
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value as any })
            }
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>Error: {error}</div>
      ) : (
        <div>Found {data?.length} companies</div>
      )}
    </div>
  );
}
```

### Pagination

```typescript
import { useCompanies } from '@/hooks';
import { useEffect, useState } from 'react';

export function PaginatedCompanyList() {
  const { data, loading, error, fetchCompanies } = useCompanies();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchCompanies({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
  }, [page, fetchCompanies]);

  return (
    <div>
      <ul>
        {data?.map((company) => (
          <li key={company.id}>{company.name}</li>
        ))}
      </ul>

      <div>
        <button onClick={() => setPage(page - 1)} disabled={page === 0}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button onClick={() => setPage(page + 1)} disabled={!data || data.length < PAGE_SIZE}>
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## useUsers Examples

### Basic User Table

```typescript
import { useUsers } from '@/hooks';
import { useEffect } from 'react';

export function UserTable() {
  const { data, total, loading, error, fetchUsers } = useUsers();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (loading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Users ({total})</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.fullName || '-'}</td>
              <td>{user.role}</td>
              <td>{user.status}</td>
              <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### With Search and Filters

```typescript
import { useUsers } from '@/hooks';
import { useEffect, useState, useCallback } from 'react';

export function SearchableUserTable() {
  const { data, total, loading, error, fetchUsers } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'admin' | 'supervisor' | 'operador' | undefined>();

  const handleSearch = useCallback(
    (search: string) => {
      setSearchTerm(search);
      fetchUsers({
        search: search || undefined,
        role: roleFilter,
      });
    },
    [roleFilter, fetchUsers]
  );

  const handleRoleChange = useCallback(
    (role: string) => {
      setRoleFilter(role as any);
      fetchUsers({
        search: searchTerm || undefined,
        role: role as any,
      });
    },
    [searchTerm, fetchUsers]
  );

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by email or name..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select value={roleFilter || ''} onChange={(e) => handleRoleChange(e.target.value)}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="supervisor">Supervisor</option>
          <option value="operador">Operator</option>
        </select>
      </div>

      <div>Total users: {total}</div>

      <table>
        <tbody>
          {data?.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## useCreateCompany Examples

### Simple Form

```typescript
import { useCreateCompany } from '@/hooks';
import { FormEvent, useState } from 'react';

export function CreateCompanyForm() {
  const { loading, error, success, createCompany, reset } = useCreateCompany();
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    cnpj: '',
    description: '',
    plan: 'starter' as const,
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await createCompany(formData);
  };

  const handleReset = () => {
    setFormData({
      name: '',
      slug: '',
      cnpj: '',
      description: '',
      plan: 'starter',
    });
    reset();
  };

  if (success) {
    return (
      <div style={{ color: 'green' }}>
        <p>Company created successfully!</p>
        <button onClick={handleReset}>Create Another</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          Company Name:
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </label>
      </div>

      <div>
        <label>
          Slug:
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="lowercase-with-hyphens"
            required
          />
        </label>
      </div>

      <div>
        <label>
          CNPJ:
          <input
            type="text"
            value={formData.cnpj}
            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
            placeholder="XX.XXX.XXX/XXXX-XX"
            required
          />
        </label>
      </div>

      <div>
        <label>
          Description:
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </label>
      </div>

      <div>
        <label>
          Plan:
          <select
            value={formData.plan}
            onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
          >
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
      </div>

      {error && <div style={{ color: 'red' }}>Error: {error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Company'}
      </button>
    </form>
  );
}
```

---

## useCreateUser Examples

### Modal Form

```typescript
import { useCreateUser } from '@/hooks';
import { FormEvent, useState } from 'react';

export function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { loading, error, success, createUser } = useCreateUser();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'supervisor' | 'operador'>('operador');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await createUser({ email, fullName, role });
  };

  if (success) {
    return (
      <div>
        <p>User created successfully!</p>
        <button onClick={() => {
          onSuccess();
          onClose();
        }}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>Create New User</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full Name"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="operador">Operator</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>

        {error && <div style={{ color: 'red' }}>{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create'}
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </form>
    </div>
  );
}
```

---

## useUpdateUserRole Examples

### Inline Role Editor

```typescript
import { useUpdateUserRole } from '@/hooks';
import { useState } from 'react';
import { UserInCompanyResponse } from '@/hooks/types';

export function UserRoleEditor({ user }: { user: UserInCompanyResponse }) {
  const { loading, error, updateRole } = useUpdateUserRole();
  const [role, setRole] = useState(user.role);

  const handleRoleChange = async (newRole: string) => {
    setRole(newRole as any);
    await updateRole(user.id, newRole as any);
  };

  return (
    <div>
      <select
        value={role}
        onChange={(e) => handleRoleChange(e.target.value)}
        disabled={loading}
      >
        <option value="operador">Operator</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Admin</option>
      </select>
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </div>
  );
}
```

### Bulk Role Update

```typescript
import { useUpdateUserRole } from '@/hooks';
import { useState } from 'react';

export function BulkRoleUpdate({ userIds }: { userIds: string[] }) {
  const { loading, error } = useUpdateUserRole();
  const [newRole, setNewRole] = useState<'admin' | 'supervisor' | 'operador'>('supervisor');
  const [completed, setCompleted] = useState(0);

  const handleBulkUpdate = async () => {
    for (const userId of userIds) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      setCompleted(c => c + 1);
    }
  };

  return (
    <div>
      <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
        <option value="operador">Operator</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Admin</option>
      </select>

      <button onClick={handleBulkUpdate} disabled={loading}>
        Update {userIds.length} Users
      </button>

      <progress value={completed} max={userIds.length} />
      <span>{completed}/{userIds.length}</span>

      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
```

---

## useDeleteUser Examples

### Delete with Confirmation

```typescript
import { useDeleteUser } from '@/hooks';
import { useState } from 'react';

export function DeleteUserButton({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { loading, error, deleteUser } = useDeleteUser();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to remove ${userEmail}?`)) {
      await deleteUser(userId);
      setShowConfirm(false);
    }
  };

  return (
    <div>
      <button onClick={handleDelete} disabled={loading} style={{ color: 'red' }}>
        {loading ? 'Removing...' : 'Remove User'}
      </button>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}
```

### Batch Delete

```typescript
import { useDeleteUser } from '@/hooks';
import { useState, useCallback } from 'react';

export function BatchDeleteUsers({ userIds }: { userIds: string[] }) {
  const { loading, error, deleteUser } = useDeleteUser();
  const [deleted, setDeleted] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);

  const handleBatchDelete = useCallback(async () => {
    if (!confirm(`Delete ${userIds.length} users?`)) return;

    for (let i = 0; i < userIds.length; i++) {
      setCurrent(i);
      await deleteUser(userIds[i]);
      setDeleted(d => [...d, userIds[i]]);
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
    }
  }, [userIds, deleteUser]);

  return (
    <div>
      <button onClick={handleBatchDelete} disabled={loading}>
        Delete {userIds.length} Users
      </button>

      <progress value={deleted.length} max={userIds.length} />
      <span>{deleted.length}/{userIds.length}</span>

      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}
```

---

## Advanced Patterns

### Combined List and Action Component

```typescript
import { useUsers, useDeleteUser, useUpdateUserRole } from '@/hooks';
import { useEffect, useState } from 'react';

export function UserManagement() {
  const { data: users, loading, fetchUsers } = useUsers();
  const { deleteUser } = useDeleteUser();
  const { updateRole } = useUpdateUserRole();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers({ limit: 50 });
  }, [fetchUsers]);

  const handleDelete = async (userId: string) => {
    if (window.confirm('Remove this user?')) {
      await deleteUser(userId);
      // Refresh the list
      fetchUsers({ limit: 50 });
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    await updateRole(userId, newRole as any);
    // Refresh the list
    fetchUsers({ limit: 50 });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users?.map(user => (
            <tr key={user.id} style={{ backgroundColor: selectedUser === user.id ? '#f0f0f0' : 'transparent' }}>
              <td onClick={() => setSelectedUser(user.id)}>{user.email}</td>
              <td>
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                >
                  <option value="operador">Operator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>{user.status}</td>
              <td>
                <button onClick={() => handleDelete(user.id)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Form with Optimistic Updates

```typescript
import { useCreateUser } from '@/hooks';
import { useState } from 'react';

interface OptimisticUser {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'success' | 'error';
}

export function OptimisticUserForm() {
  const { createUser } = useCreateUser();
  const [users, setUsers] = useState<OptimisticUser[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'supervisor' | 'operador'>('operador');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticUser: OptimisticUser = {
      id: tempId,
      email,
      role,
      status: 'pending',
    };

    setUsers(u => [...u, optimisticUser]);

    try {
      await createUser({ email, fullName: '', role });

      // Update status to success
      setUsers(u =>
        u.map(user =>
          user.id === tempId ? { ...user, status: 'success' } : user
        )
      );

      setEmail('');
    } catch (error) {
      // Update status to error
      setUsers(u =>
        u.map(user =>
          user.id === tempId ? { ...user, status: 'error' } : user
        )
      );
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="operador">Operator</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit">Add User</button>
      </form>

      <ul>
        {users.map(user => (
          <li key={user.id} style={{ opacity: user.status === 'pending' ? 0.6 : 1 }}>
            {user.email} ({user.status})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Custom Error Toast

```typescript
import { useCreateUser } from '@/hooks';
import { useState, useEffect } from 'react';

export function FormWithErrorToast() {
  const { createUser, error } = useCreateUser();
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (error) {
      setToastMessage(error);
      setTimeout(() => setToastMessage(''), 5000);
    }
  }, [error]);

  return (
    <div>
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '15px',
            borderRadius: '4px',
            maxWidth: '300px',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Your form here */}
    </div>
  );
}
```
