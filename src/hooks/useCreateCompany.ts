import { useState, useCallback } from 'react';
import { CompanyResponse, CreateCompanyRequest } from '@/types/admin';

interface UseCreateCompanyState {
  data: CompanyResponse | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

interface ValidationError {
  [key: string]: string | string[];
}

interface ErrorResponse {
  details?: ValidationError;
}

/**
 * Custom hook to create a new company
 * Requires authentication with admin/master role
 *
 * @example
 * const { data, loading, error, success, createCompany } = useCreateCompany();
 *
 * const handleCreate = async () => {
 *   await createCompany({
 *     name: 'Acme Corp',
 *     slug: 'acme-corp',
 *     cnpj: '12.345.678/0001-90',
 *     description: 'A great company',
 *     plan: 'professional'
 *   });
 * };
 */
export const useCreateCompany = () => {
  const [state, setState] = useState<UseCreateCompanyState>({
    data: null,
    loading: false,
    error: null,
    success: false,
  });

  const createCompany = useCallback(async (companyData: CreateCompanyRequest) => {
    setState({ data: null, loading: true, error: null, success: false });

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(companyData),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error?.message || 'Failed to create company';
        const errorDetails = (result.error as ErrorResponse)?.details;
        const detailsMessage = errorDetails
          ? Object.entries(errorDetails)
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
              .join('; ')
          : '';

        throw new Error(detailsMessage || errorMessage);
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
    createCompany,
    reset,
  };
};
