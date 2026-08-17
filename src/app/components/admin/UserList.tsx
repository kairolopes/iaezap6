'use client';

// UserList.tsx - Company user table with role editing and delete confirmation.
import React, { useMemo, useState } from 'react';
import type { UserInCompanyResponse, UserRole } from '@/types/admin';
import { RoleBadge } from './RoleBadge';
import { StatusIndicator } from './StatusIndicator';
import { Pagination } from './Pagination';

const ROLE_OPTIONS: UserRole[] = ['owner', 'admin', 'member', 'viewer'];

interface UserListProps {
  users: UserInCompanyResponse[];
  onCreateClick?: () => void;
  onRoleChange?: (user: UserInCompanyResponse, newRole: UserRole) => void;
  onDeleteClick?: (user: UserInCompanyResponse) => void;
  /** Roles that are not allowed to be edited/removed from the UI (e.g. current user, last owner) */
  isRowLocked?: (user: UserInCompanyResponse) => boolean;
  itemsPerPage?: number;
  loading?: boolean;
}

function formatDate(dateString?: string) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeTime(dateString?: string | null) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export const UserList: React.FC<UserListProps> = ({
  users,
  onCreateClick,
  onRoleChange,
  onDeleteClick,
  isRowLocked,
  itemsPerPage = 10,
  loading = false,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(users.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedUsers = useMemo(
    () => users.slice(startIndex, startIndex + itemsPerPage),
    [users, startIndex, itemsPerPage]
  );

  const handleDeleteClick = (user: UserInCompanyResponse) => {
    if (deleteConfirm === user.id) {
      onDeleteClick?.(user);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(user.id);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Users</h2>
        {onCreateClick && (
          <button
            type="button"
            onClick={onCreateClick}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
          >
            <span>+</span>
            <span>Add User</span>
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 text-lg">No users found.</p>
          {onCreateClick && (
            <button
              type="button"
              onClick={onCreateClick}
              className="mt-4 px-4 py-2 text-blue-600 font-medium hover:text-blue-700"
            >
              Add your first user
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-gray-300 rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-300">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedUsers.map((user) => {
                  const locked = isRowLocked?.(user) ?? false;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.fullName || user.displayName || user.email}
                        </div>
                        {!user.emailVerified && (
                          <div className="text-xs text-amber-600">Email not verified</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {onRoleChange && !locked ? (
                          <select
                            value={user.role}
                            disabled={loading}
                            onChange={(e) => onRoleChange(user, e.target.value as UserRole)}
                            className="text-xs font-medium border border-gray-300 rounded-md px-2 py-1 disabled:opacity-50"
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <RoleBadge role={user.role} />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusIndicator status={user.status} showLabel={true} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {formatRelativeTime(user.lastLoginAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {onDeleteClick && !locked && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(user)}
                            disabled={loading}
                            className={`px-3 py-1 text-sm font-medium rounded transition-colors duration-150 disabled:opacity-50 ${
                              deleteConfirm === user.id
                                ? 'text-white bg-red-600 hover:bg-red-700'
                                : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                            }`}
                            title={
                              deleteConfirm === user.id
                                ? 'Click again to confirm removal'
                                : 'Remove user from company'
                            }
                          >
                            {deleteConfirm === user.id ? 'Confirm' : 'Remove'}
                          </button>
                        )}
                        {locked && <span className="text-xs text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}

          <div className="mt-4 text-sm text-gray-600 text-center">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, users.length)} of{' '}
            {users.length} users
          </div>
        </>
      )}
    </div>
  );
};
