import { useState, useCallback } from 'react';

interface UseDeleteUserState {
  deletedUserId: string | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

interface ErrorResponse {
  details?: any;
}

/**
 * Custom hook to delete (soft delete) a user from the company
 * Requires authentication with admin role
 *
 * @example
 * const { loading, error, success, deleteUser } = useDeleteUser();
 *
 * const handleDelete = async (userId: string) => {
 *   await deleteUser(userId);
 * };
 */
export const useDeleteUser = () => {
  const [state, setState] = useState<UseDeleteUserState>({
    deletedUserId: null,
    loading: false,
    error: null,
    success: false,
  });

  const deleteUser = useCallback(async (userId: string) => {
    setState({ deletedUserId: null, loading: true, error: null, success: false });

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.message || 'Failed to delete user';
        const errorDetails = (result.error as ErrorResponse)?.details;
        const detailsMessage = errorDetails
          ? typeof errorDetails === 'string'
            ? errorDetails
            : Object.entries(errorDetails)
                .map(([key, value]) => `${key}: ${value}`)
                .join('; ')
          : '';

        throw new Error(detailsMessage || errorMessage);
      }

      if (result.success) {
        setState({
          deletedUserId: result.data.userId,
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
        deletedUserId: null,
        loading: false,
        error: errorMessage,
        success: false,
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      deletedUserId: null,
      loading: false,
      error: null,
      success: false,
    });
  }, []);

  return {
    ...state,
    deleteUser,
    reset,
  };
};
