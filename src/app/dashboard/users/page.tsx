'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { UserList } from '@/app/components/admin';
import { useUsers, useCreateUser, useUpdateUserRole, useDeleteUser } from '@/hooks';
import { hasMinimumRole, type User as CompanyUser, type UserRole } from '@/types/company';

interface StoredUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  company_id: string;
}

const ROLE_OPTIONS: UserRole[] = ['viewer', 'member', 'admin', 'owner'];

export default function UsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);

  const { data: users, loading, error, fetchUsers } = useUsers();
  const createUserHook = useCreateUser();
  const updateRoleHook = useUpdateUserRole();
  const deleteUserHook = useDeleteUser();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ email: '', fullName: '', role: 'member' as UserRole });
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auth guard, matching the pattern used by /dashboard and /dashboard/crm
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const tokenStr = localStorage.getItem('access_token');

    if (!userStr || !tokenStr) {
      router.push('/login');
      return;
    }

    setCurrentUser(JSON.parse(userStr));
  }, [router]);

  const loadUsers = useCallback(() => {
    fetchUsers({ limit: 100 });
  }, [fetchUsers]);

  useEffect(() => {
    if (currentUser) {
      loadUsers();
    }
  }, [currentUser, loadUsers]);

  // Build a minimal, honestly-typed company.ts `User` to reuse its RBAC helper
  // instead of re-implementing the owner > admin > member > viewer hierarchy here.
  const currentAsCompanyUser: CompanyUser | null = currentUser
    ? {
        id: currentUser.id,
        email: currentUser.email,
        fullName: currentUser.full_name || undefined,
        role: (currentUser.role as UserRole) || 'viewer',
        status: 'active',
        companyId: currentUser.company_id,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    : null;

  const canManageUsers = currentAsCompanyUser
    ? hasMinimumRole(currentAsCompanyUser, 'admin')
    : false;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    await createUserHook.createUser({
      email: form.email,
      fullName: form.fullName || undefined,
      role: form.role,
    });
  };

  useEffect(() => {
    if (createUserHook.success) {
      setBanner({ type: 'success', message: `User ${form.email} added successfully.` });
      setForm({ email: '', fullName: '', role: 'member' });
      setShowCreateForm(false);
      createUserHook.reset();
      loadUsers();
    } else if (createUserHook.error) {
      setBanner({ type: 'error', message: createUserHook.error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createUserHook.success, createUserHook.error]);

  const handleRoleChange = async (user: { id: string; email: string }, newRole: UserRole) => {
    setBanner(null);
    await updateRoleHook.updateRole(user.id, newRole);
  };

  useEffect(() => {
    if (updateRoleHook.success) {
      setBanner({ type: 'success', message: 'Role updated successfully.' });
      updateRoleHook.reset();
      loadUsers();
    } else if (updateRoleHook.error) {
      setBanner({ type: 'error', message: updateRoleHook.error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateRoleHook.success, updateRoleHook.error]);

  const handleDeleteUser = async (user: { id: string; email: string }) => {
    setBanner(null);
    await deleteUserHook.deleteUser(user.id);
  };

  useEffect(() => {
    if (deleteUserHook.success) {
      setBanner({ type: 'success', message: 'User removed from company.' });
      deleteUserHook.reset();
      loadUsers();
    } else if (deleteUserHook.error) {
      setBanner({ type: 'error', message: deleteUserHook.error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteUserHook.success, deleteUserHook.error]);

  if (!currentUser) {
    return <div className="p-8 text-slate-500">Loading...</div>;
  }

  const mutating = createUserHook.loading || updateRoleHook.loading || deleteUserHook.loading;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar userName={currentUser.full_name || currentUser.email} userRole={currentUser.role} />

      <div className="flex-1 bg-gray-100">
        <header className="bg-white border-b border-gray-200 px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage the members of your company.</p>
        </header>

        <main className="p-8 max-w-6xl mx-auto">
          {banner && (
            <div
              className={`mb-6 p-4 rounded-lg border flex justify-between items-start ${
                banner.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <span className="text-sm font-medium">{banner.message}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="text-sm underline ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {error && !banner && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {!canManageUsers && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              Your role ({currentUser.role}) can view users but cannot create, edit roles, or
              remove members. Only admin and owner roles can manage users.
            </div>
          )}

          {showCreateForm && (
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h3>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Full name (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createUserHook.loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    {createUserHook.loading ? 'Adding...' : 'Add User'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <UserList
            users={users || []}
            loading={mutating || loading}
            onCreateClick={canManageUsers ? () => setShowCreateForm(true) : undefined}
            onRoleChange={canManageUsers ? handleRoleChange : undefined}
            onDeleteClick={canManageUsers ? handleDeleteUser : undefined}
            isRowLocked={(user) => user.id === currentUser.id}
          />
        </main>
      </div>
    </div>
  );
}
