import { useState, useCallback } from 'react';
import { UserInCompanyResponse, AddUserToCompanyRequest } from '@/types/admin';

interface UseCreateUserState {
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

/**
 * Custom hook to create a new user in the authenticated user's company
 * Requires authentication with admin role
 *
 * @example
 * const { data, loading, error, success, createUser } = useCreateUser();
 *
 * const handleCreate = async () => {
 *   await createUser({
 *     email: 'john@example.com',
 *     fullName: 'John Doe',
 *     role: 'supervisor'
 *   });
 * };
 */
export const useCreateUser = () => {
  const [state, setState] = useState<UseCreateUserState>({
    data: null,
    loading: false,
    error: null,
    success: false,
  });

  const createUser = useCallback(async (userData: AddUserToCompanyRequest) => {
    setState({ data: null, loading: true, error: null, success: false });

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.message || 'Failed to create user';
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
    createUser,
    reset,
  };
};
