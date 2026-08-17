import { useState, useCallback } from 'react';
import { UserInCompanyResponse } from '@/types/admin';

interface UseUsersState {
  data: UserInCompanyResponse[] | null;
  total: number | null;
  limit: number;
  offset: number;
  loading: boolean;
  error: string | null;
  success: boolean;
}

interface UseUsersOptions {
  role?: 'owner' | 'admin' | 'member' | 'viewer';
  status?: 'active' | 'inactive' | 'invited' | 'suspended';
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Custom hook to fetch users from the authenticated user's company
 * Requires authentication with admin role
 *
 * @example
 * const { data: users, loading, error, fetchUsers } = useUsers();
 *
 * useEffect(() => {
 *   fetchUsers({ role: 'admin', limit: 50 });
 * }, [fetchUsers]);
 */
export const useUsers = () => {
  const [state, setState] = useState<UseUsersState>({
    data: null,
    total: null,
    limit: 50,
    offset: 0,
    loading: false,
    error: null,
    success: false,
  });

  const fetchUsers = useCallback(async (options?: UseUsersOptions) => {
    setState(prev => ({ ...prev, loading: true, error: null, success: false }));

    try {
      const queryParams = new URLSearchParams();

      if (options?.role) {
        queryParams.append('role', options.role);
      }
      if (options?.status) {
        queryParams.append('status', options.status);
      }
      if (options?.search) {
        queryParams.append('search', options.search);
      }
      if (options?.limit) {
        queryParams.append('limit', options.limit.toString());
      }
      if (options?.offset !== undefined) {
        queryParams.append('offset', options.offset.toString());
      }

      const url = `/api/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to fetch users');
      }

      if (result.success) {
        setState({
          data: result.data.users,
          total: result.data.total,
          limit: result.data.limit,
          offset: result.data.offset,
          loading: false,
          error: null,
          success: true,
        });
      } else {
        throw new Error(result.error?.message || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        success: false,
      }));
    }
  }, []);

  return {
    ...state,
    fetchUsers,
  };
};
