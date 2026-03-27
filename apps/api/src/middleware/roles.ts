import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/** Role names stored in DB `roles.name` */
export const RoleName = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
} as const;

export type RoleName = (typeof RoleName)[keyof typeof RoleName];

const RANK: Record<string, number> = {
  [RoleName.VIEWER]: 0,
  [RoleName.OPERATOR]: 1,
  [RoleName.ADMIN]: 2,
};

function rank(roleName: string | null | undefined): number {
  if (!roleName) return RANK[RoleName.VIEWER];
  return RANK[roleName] ?? RANK[RoleName.VIEWER];
}

function isMutating(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

/** Production data changes: operator, admin, or superuser */
export function requireOperatorForMutations(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!isMutating(req.method)) {
    next();
    return;
  }
  if (req.isSuperuser) {
    next();
    return;
  }
  if (rank(req.roleName) >= RANK[RoleName.OPERATOR]) {
    next();
    return;
  }
  res.status(403).json({ error: 'Insufficient permissions (operator role required)' });
}

/** User/role/API key management: admin or superuser */
export function requireAdminForMutations(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!isMutating(req.method)) {
    next();
    return;
  }
  if (req.isSuperuser) {
    next();
    return;
  }
  if (rank(req.roleName) >= RANK[RoleName.ADMIN]) {
    next();
    return;
  }
  res.status(403).json({ error: 'Insufficient permissions (admin role required)' });
}

/** Explicit permission check for programmatic use */
export function hasAtLeastRole(
  roleName: string | null | undefined,
  min: 'viewer' | 'operator' | 'admin',
  isSuperuser?: boolean,
): boolean {
  if (isSuperuser) return true;
  const need = RANK[min];
  return rank(roleName) >= need;
}
