/**
 * Role-Based Access Control (RBAC) utility module
 * Provides functions for managing user roles and permissions
 */

/**
 * User role type definition
 */
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * User status type definition
 */
export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

/**
 * Role hierarchy levels for permission comparison
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  'owner': 4,
  'admin': 3,
  'member': 2,
  'viewer': 1,
};

/**
 * Permissions map defining what each role can do
 */
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'owner': [
    'read:users',
    'write:users',
    'delete:users',
    'manage:roles',
    'manage:company',
    'manage:billing',
    'manage:settings',
    'manage:webhooks',
    'view:audit_logs',
  ],
  'admin': [
    'read:users',
    'write:users',
    'delete:users',
    'manage:roles', // Can manage non-owner users
    'manage:settings',
    'manage:webhooks',
    'view:audit_logs',
  ],
  'member': [
    'read:users',
    'write:own_profile',
    'view:shared_resources',
  ],
  'viewer': [
    'read:users',
    'view:shared_resources',
  ],
};

/**
 * Check if one role has a higher or equal position in the hierarchy than another
 * @param actorRole - The role of the user performing the action
 * @param targetRole - The role being accessed or modified
 * @returns true if actor can access/modify target
 */
export function isRoleHierarchyValid(actorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY[targetRole];
}

/**
 * Check if a role has a specific permission
 * @param role - The user role
 * @param permission - The permission to check
 * @returns true if role has permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Check if actor can manage target user
 * Owner can manage anyone, Admin can manage non-owners
 * @param actorRole - Role of the user performing action
 * @param targetRole - Role of the user being managed
 * @returns true if actor can manage target
 */
export function canManageUser(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'owner') {
    return true;
  }
  if (actorRole === 'admin') {
    // Admins can manage member and viewer users
    return targetRole !== 'owner';
  }
  return false;
}

/**
 * Check if actor can change target's role
 * Cannot promote users to owner, cannot demote self
 * @param actorRole - Role of the user performing action
 * @param targetRole - Current role of the user
 * @param newRole - New role to assign
 * @returns true if role change is allowed
 */
export function canChangeRole(
  actorRole: UserRole,
  targetRole: UserRole,
  newRole: UserRole
): boolean {
  // Can't demote to self
  if (targetRole === newRole) {
    return true;
  }

  // Can't promote to owner except by current owner
  if (newRole === 'owner' && actorRole !== 'owner') {
    return false;
  }

  // Check hierarchy
  return canManageUser(actorRole, targetRole);
}

/**
 * Check if actor can delete target user
 * Cannot delete self, cannot delete owner as admin
 * @param actorRole - Role of the user performing action
 * @param targetRole - Role of the user being deleted
 * @param isSameUser - Whether it's the same user
 * @returns true if deletion is allowed
 */
export function canDeleteUser(
  actorRole: UserRole,
  targetRole: UserRole,
  isSameUser: boolean
): boolean {
  // Can't delete self
  if (isSameUser) {
    return false;
  }

  // Must be admin or owner
  if (!['admin', 'owner'].includes(actorRole)) {
    return false;
  }

  // Admin can't delete owner
  if (actorRole === 'admin' && targetRole === 'owner') {
    return false;
  }

  return true;
}

/**
 * Get all permissions for a given role
 * @param role - The user role
 * @returns Array of permissions
 */
export function getPermissionsForRole(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if a user is in a management role (can manage other users)
 * @param role - The user role
 * @returns true if role can manage users
 */
export function isManagementRole(role: UserRole): boolean {
  return ['admin', 'owner'].includes(role);
}

/**
 * Get role hierarchy level (1-4, where 4 is highest)
 * @param role - The user role
 * @returns Hierarchy level
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role];
}

/**
 * Compare two roles
 * @param role1 - First role
 * @param role2 - Second role
 * @returns 1 if role1 > role2, -1 if role1 < role2, 0 if equal
 */
export function compareRoles(role1: UserRole, role2: UserRole): number {
  const level1 = ROLE_HIERARCHY[role1];
  const level2 = ROLE_HIERARCHY[role2];
  if (level1 > level2) return 1;
  if (level1 < level2) return -1;
  return 0;
}

/**
 * Validate if a role string is a valid role
 * @param role - String to validate
 * @returns true if valid role
 */
export function isValidRole(role: string): role is UserRole {
  return ['owner', 'admin', 'member', 'viewer'].includes(role);
}

/**
 * Validate if a status string is a valid status
 * @param status - String to validate
 * @returns true if valid status
 */
export function isValidStatus(status: string): status is UserStatus {
  return ['active', 'inactive', 'invited', 'suspended'].includes(status);
}

/**
 * Get all valid roles
 * @returns Array of valid roles
 */
export function getAllRoles(): UserRole[] {
  return ['owner', 'admin', 'member', 'viewer'];
}

/**
 * Get all valid statuses
 * @returns Array of valid statuses
 */
export function getAllStatuses(): UserStatus[] {
  return ['active', 'inactive', 'invited', 'suspended'];
}

/**
 * Get role display name
 * @param role - The user role
 * @returns Display name for UI
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    'owner': 'Company Owner',
    'admin': 'Administrator',
    'member': 'Member',
    'viewer': 'Viewer',
  };
  return names[role];
}

/**
 * Get role description
 * @param role - The user role
 * @returns Description of role
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    'owner': 'Full access to all company features and settings',
    'admin': 'Can manage users and most settings, but cannot modify owners',
    'member': 'Can access and contribute to company resources',
    'viewer': 'Read-only access to shared resources',
  };
  return descriptions[role];
}
