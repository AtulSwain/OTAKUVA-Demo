// Platform-level RBAC roles. Distinct from per-community roles
// (CommunityMember.role, e.g. "OWNER"/"MODERATOR"/"MEMBER"), which are
// scoped to a single community and unrelated to platform admin access.
//
// Stored as a plain string on User.role (SQLite has no native enum
// support in Prisma), so this file is the single source of truth for
// valid values and their ordering.

export const ROLES = [
  'USER',
  'MODERATOR',
  'NEWS_EDITOR',
  'MEDIA_MANAGER',
  'DATA_EDITOR',
  'ADMIN',
  'SUPER_ADMIN',
] as const;

export type Role = (typeof ROLES)[number];

// Higher number = more privileged. NEWS_EDITOR/MEDIA_MANAGER/DATA_EDITOR
// sit at the same tier (domain specialists) — none is a superset of the
// others; ADMIN and SUPER_ADMIN sit above every domain role.
const ROLE_LEVEL: Record<Role, number> = {
  USER: 0,
  MODERATOR: 1,
  NEWS_EDITOR: 2,
  MEDIA_MANAGER: 2,
  DATA_EDITOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function roleLevel(role: string): number {
  return isValidRole(role) ? ROLE_LEVEL[role] : 0;
}

// True if `role` satisfies a `minRole` requirement.
// - Everyone satisfies USER.
// - ADMIN/SUPER_ADMIN satisfy every requirement (they outrank all domain
//   specialists and MODERATOR).
// - Otherwise the roles must match exactly: the level-2 domain roles
//   (NEWS_EDITOR/MEDIA_MANAGER/DATA_EDITOR) are siblings, not a hierarchy —
//   holding one does not grant another, and MODERATOR does not imply or
//   get implied by any of them.
export function hasMinRole(role: string, minRole: Role): boolean {
  if (!isValidRole(role)) return false;
  if (minRole === 'USER') return true;
  if (role === minRole) return true;
  return roleLevel(role) >= ROLE_LEVEL.ADMIN;
}
