'use client';

// RoleBadge.tsx - Color-coded badge for a company member's role.
// Role values match the `user_role` Postgres enum (owner > admin > member > viewer).
import React from 'react';
import type { UserRole } from '@/types/admin';

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

const roleConfig: Record<UserRole, { bg: string; text: string; label: string }> = {
  owner: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    label: 'Owner',
  },
  admin: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Admin',
  },
  member: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Member',
  },
  viewer: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: 'Viewer',
  },
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
  const config = roleConfig[role] ?? roleConfig.viewer;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}
    >
      {config.label}
    </span>
  );
};
