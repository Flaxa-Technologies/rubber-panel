// RBAC — Role-Based Access Control
// Uses string types since SQLite Prisma doesn't support enums

export type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF" | "USER";

// Permission constants
export const PERMISSIONS = {
  USERS_VIEW: "users:view",
  USERS_CREATE: "users:create",
  USERS_EDIT: "users:edit",
  USERS_DELETE: "users:delete",
  USERS_SUSPEND: "users:suspend",

  SERVERS_VIEW: "servers:view",
  SERVERS_CREATE: "servers:create",
  SERVERS_EDIT: "servers:edit",
  SERVERS_DELETE: "servers:delete",
  SERVERS_SUSPEND: "servers:suspend",
  SERVERS_POWER: "servers:power",

  NODES_VIEW: "nodes:view",
  NODES_CREATE: "nodes:create",
  NODES_EDIT: "nodes:edit",
  NODES_DELETE: "nodes:delete",

  ALLOCATIONS_VIEW: "allocations:view",
  ALLOCATIONS_CREATE: "allocations:create",
  ALLOCATIONS_DELETE: "allocations:delete",

  SETTINGS_VIEW: "settings:view",
  SETTINGS_EDIT: "settings:edit",

  AUDIT_LOGS_VIEW: "audit_logs:view",

  API_KEYS_VIEW: "api_keys:view",
  API_KEYS_CREATE: "api_keys:create",
  API_KEYS_DELETE: "api_keys:delete",
} as const;

type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS) as Permission[],
  ADMIN: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_EDIT,
    PERMISSIONS.USERS_SUSPEND,
    PERMISSIONS.SERVERS_VIEW,
    PERMISSIONS.SERVERS_CREATE,
    PERMISSIONS.SERVERS_EDIT,
    PERMISSIONS.SERVERS_SUSPEND,
    PERMISSIONS.SERVERS_POWER,
    PERMISSIONS.NODES_VIEW,
    PERMISSIONS.NODES_CREATE,
    PERMISSIONS.NODES_EDIT,
    PERMISSIONS.ALLOCATIONS_VIEW,
    PERMISSIONS.ALLOCATIONS_CREATE,
    PERMISSIONS.ALLOCATIONS_DELETE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.AUDIT_LOGS_VIEW,
    PERMISSIONS.API_KEYS_VIEW,
    PERMISSIONS.API_KEYS_CREATE,
    PERMISSIONS.API_KEYS_DELETE,
  ],
  STAFF: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.SERVERS_VIEW,
    PERMISSIONS.SERVERS_POWER,
    PERMISSIONS.NODES_VIEW,
    PERMISSIONS.ALLOCATIONS_VIEW,
    PERMISSIONS.AUDIT_LOGS_VIEW,
  ],
  USER: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function isAdminRole(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF";
}

export function canManageRole(actorRole: string, targetRole: string): boolean {
  const hierarchy: Record<string, number> = {
    SUPER_ADMIN: 4,
    ADMIN: 3,
    STAFF: 2,
    USER: 1,
  };
  return (hierarchy[actorRole] ?? 0) > (hierarchy[targetRole] ?? 0);
}
