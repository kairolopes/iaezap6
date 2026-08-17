'use client';

// CompanyList.tsx - Company table with create button and pagination.
// Master/owner-only view: lists companies via GET /api/admin/companies.
import React, { useMemo, useState } from 'react';
import type { CompanyResponse } from '@/types/admin';
import { StatusIndicator } from './StatusIndicator';
import { Pagination } from './Pagination';

interface CompanyListProps {
  companies: CompanyResponse[];
  onCreateClick: () => void;
  onRowClick?: (company: CompanyResponse) => void;
  itemsPerPage?: number;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const PLAN_LABEL: Record<CompanyResponse['plan'], string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export const CompanyList: React.FC<CompanyListProps> = ({
  companies,
  onCreateClick,
  onRowClick,
  itemsPerPage = 10,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(companies.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedCompanies = useMemo(
    () => companies.slice(startIndex, startIndex + itemsPerPage),
    [companies, startIndex, itemsPerPage]
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Companies</h2>
        <button
          type="button"
          onClick={onCreateClick}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
        >
          <span>+</span>
          <span>Create Company</span>
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 text-lg">No companies found.</p>
          <button
            type="button"
            onClick={onCreateClick}
            className="mt-4 px-4 py-2 text-blue-600 font-medium hover:text-blue-700"
          >
            Create your first company
          </button>
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
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    CNPJ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedCompanies.map((company) => (
                  <tr
                    key={company.id}
                    onClick={() => onRowClick?.(company)}
                    className={`hover:bg-gray-50 transition-colors duration-150 ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{company.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{company.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{company.cnpj || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{PLAN_LABEL[company.plan]}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusIndicator status={company.status} showLabel={true} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(company.createdAt)}
                    </td>
                  </tr>
                ))}
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
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, companies.length)} of{' '}
            {companies.length} companies
          </div>
        </>
      )}
    </div>
  );
};
