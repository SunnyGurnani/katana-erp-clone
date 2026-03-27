import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';

/**
 * Multi-tenant middleware.
 * Extracts tenant context from the X-Tenant-Id header or the user's default membership.
 * Attaches tenantId to the request for downstream use.
 */
export interface TenantRequest extends AuthRequest {
  tenantId?: string;
}

export async function tenantMiddleware(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.userId) return next(); // auth middleware hasn't run yet or public route

  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;

  if (headerTenantId) {
    // Verify user has access to this tenant
    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: headerTenantId, userId: req.userId } },
      include: { tenant: { select: { id: true, isActive: true } } },
    });

    if (!membership || !membership.tenant.isActive) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }

    req.tenantId = headerTenantId;
    return next();
  }

  // Fall back to user's default tenant membership
  const defaultMembership = await prisma.tenantMembership.findFirst({
    where: { userId: req.userId, isDefault: true },
    include: { tenant: { select: { id: true, isActive: true } } },
  });

  if (defaultMembership && defaultMembership.tenant.isActive) {
    req.tenantId = defaultMembership.tenantId;
    return next();
  }

  // Try any active membership
  const anyMembership = await prisma.tenantMembership.findFirst({
    where: { userId: req.userId, tenant: { isActive: true } },
    include: { tenant: { select: { id: true } } },
  });

  if (anyMembership) {
    req.tenantId = anyMembership.tenantId;
    return next();
  }

  // Superusers can proceed without tenant for admin operations
  if (req.isSuperuser) {
    return next();
  }

  return res.status(400).json({ error: 'No tenant context. Create or join an organization first.' });
}

/**
 * Helper to build a where clause that scopes queries to the current tenant.
 * If tenantId is null (superuser), returns empty object (no filtering).
 */
export function tenantWhere(req: TenantRequest): Record<string, any> {
  if (req.tenantId) return { tenantId: req.tenantId };
  return {};
}

/**
 * Helper to include tenantId in create data.
 */
export function tenantData(req: TenantRequest): Record<string, any> {
  if (req.tenantId) return { tenantId: req.tenantId };
  return {};
}
