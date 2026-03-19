import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  isSuperuser?: boolean;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    if (payload.type !== 'access') return res.status(401).json({ error: 'Invalid token type' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found or inactive' });
    req.userId = user.id;
    req.userEmail = user.email;
    req.isSuperuser = user.isSuperuser;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireSuperuser(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isSuperuser) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
}
