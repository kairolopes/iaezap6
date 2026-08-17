import { useState, useCallback } from 'react';
import { CompanyResponse } from '@/types/admin';

interface UseCompaniesState {
  data: CompanyResponse[] | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

interface UseCompaniesOptions {
  status?: 'active' | 'paused' | 'suspended' | 'cancelled';
  plan?: 'starter' | 'professional' | 'enterprise';
  limit?: number;
  offset?: number;
}

/**
 * Custom hook to fetch companies
 * Requires authentication with admin/master role
 *
 * @example
 * const { data: companies, loading, error, fetchCompanies } = useCompanies();
 *
 * useEffect(() => {
 *   fetchCompanies({ status: 'active', limit: 20 });
 * }, [fetchCompanies]);
 */
export const useCompanies = () => {
  const [state, setState] = useState<UseCompaniesState>({
    data: null,
    loading: false,
    error: null,
    success: false,
  });

  const fetchCompanies = useCallback(async (options?: UseCompaniesOptions) => {
    setState({ data: null, loading: true, error: null, success: false });

    try {
      const queryParams = new URLSearchParams();

      if (options?.status) {
        queryParams.append('status', options.status);
      }
      if (options?.plan) {
        queryParams.append('plan', options.plan);
      }
      if (options?.limit) {
        queryParams.append('limit', options.limit.toString());
      }
      if (options?.offset) {
        queryParams.append('offset', options.offset.toString());
      }

      const url = `/api/admin/companies${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
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
        throw new Error(result.error?.message || 'Failed to fetch companies');
      }

      if (result.success) {
        setState({
          data: result.data,
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

  return {
    ...state,
    fetchCompanies,
  };
};
