import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { createHash } from 'crypto';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  isSuperuser?: boolean;
  /** Resolved from `users.role` relation (DB `roles.name`) */
  roleName?: string | null;
}

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  // 1. Check X-API-Key header
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const hashed = hashKey(apiKey);
    const keyRecord = await prisma.apiKey.findFirst({ where: { keyHash: hashed, isActive: true } });
    if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' });
    // Update last used
    await prisma.apiKey.update({ where: { id: keyRecord.id }, data: { lastUsedAt: new Date() } });
    const user = await prisma.user.findUnique({ where: { id: keyRecord.userId }, include: { role: true } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'User inactive' });
    req.userId = user.id;
    req.userEmail = user.email;
    req.isSuperuser = user.isSuperuser;
    req.roleName = user.role?.name ?? null;
    return next();
  }

  // 2. Check Bearer JWT
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    if (payload.type !== 'access') return res.status(401).json({ error: 'Invalid token type' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found or inactive' });
    req.userId = user.id;
    req.userEmail = user.email;
    req.isSuperuser = user.isSuperuser;
    req.roleName = user.role?.name ?? null;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireSuperuser(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isSuperuser) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
}
