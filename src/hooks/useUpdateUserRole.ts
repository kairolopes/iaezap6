import { useState, useCallback } from 'react';
import { UserInCompanyResponse } from '@/types/admin';

interface UseUpdateUserRoleState {
  data: UserInCompanyResponse | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

interface ValidationError {
  [key: string]: string[];
}

interface ErrorResponse {
  details?: ValidationError;
}

type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Custom hook to update a user's role
 * Requires authentication with admin role
 *
 * @example
 * const { data, loading, error, success, updateRole } = useUpdateUserRole();
 *
 * const handleRoleChange = async (userId: string, newRole: string) => {
 *   await updateRole(userId, 'supervisor');
 * };
 */
export const useUpdateUserRole = () => {
  const [state, setState] = useState<UseUpdateUserRoleState>({
    data: null,
    loading: false,
    error: null,
    success: false,
  });

  const updateRole = useCallback(async (userId: string, newRole: UserRole) => {
    setState({ data: null, loading: true, error: null, success: false });

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role: newRole }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.message || 'Failed to update user role';
        const errorDetails = (result.error as ErrorResponse)?.details;
        const detailsMessage = errorDetails
          ? Object.entries(errorDetails)
              .map(([key, value]) => `${key}: ${value.join(', ')}`)
              .join('; ')
          : '';

        throw new Error(detailsMessage || errorMessage);
      }

      if (result.success) {
        setState({
          data: result.data.user,
          loading: false,
          error: null,
          success: true,
        });
      } else {
        throw new Error(result.error?.message || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setState({
        data: null,
        loading: false,
        error: errorMessage,
        success: false,
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      success: false,
    });
  }, []);

  return {
    ...state,
    updateRole,
    reset,
  };
};
