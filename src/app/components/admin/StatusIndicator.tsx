'use client';

// StatusIndicator.tsx - Colored dot + label for user or company status.
import React from 'react';
import type { UserStatus, CompanyStatus } from '@/types/admin';

type Status = UserStatus | CompanyStatus;

interface StatusIndicatorProps {
  status: Status;
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<Status, { color: string; bgColor: string; label: string }> = {
  // Shared / user statuses
  active: { color: 'bg-green-500', bgColor: 'bg-green-100 text-green-800', label: 'Active' },
  inactive: { color: 'bg-gray-500', bgColor: 'bg-gray-100 text-gray-800', label: 'Inactive' },
  invited: { color: 'bg-yellow-500', bgColor: 'bg-yellow-100 text-yellow-800', label: 'Invited' },
  suspended: { color: 'bg-red-500', bgColor: 'bg-red-100 text-red-800', label: 'Suspended' },
  // Company-only statuses
  paused: { color: 'bg-yellow-500', bgColor: 'bg-yellow-100 text-yellow-800', label: 'Paused' },
  cancelled: { color: 'bg-slate-500', bgColor: 'bg-slate-100 text-slate-800', label: 'Cancelled' },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  showLabel = true,
  className = '',
}) => {
  const config = statusConfig[status] ?? statusConfig.inactive;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} aria-hidden="true" />
      {showLabel && (
        <span className={`text-xs font-medium px-2 py-1 rounded ${config.bgColor}`}>
          {config.label}
        </span>
      )}
    </div>
  );
};
