import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from './auth';

export function auditMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const oldJson = res.json.bind(res);
  res.json = function(body) {
    const pathParts = req.path.split('/').filter(Boolean);
    const resourceType = pathParts[1] || 'unknown';
    const resourceId = pathParts[2];
    setImmediate(async () => {
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.userId,
            method: req.method,
            path: req.path,
            resourceType,
            resourceId,
            action: req.method.toLowerCase(),
            requestBody: JSON.stringify(req.body)?.slice(0, 2000),
            responseStatus: res.statusCode,
            ipAddress: req.ip,
          },
        });
      } catch { /* best-effort */ }
    });
    return oldJson(body);
  };
  next();
}
