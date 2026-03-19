import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation error', issues: err.errors });
  }
  // Prisma unique constraint
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Already exists', fields: err.meta?.target });
  }
  // Prisma not found
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Not found' });
  }
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  if (status === 500) console.error('[ERROR]', err);
  res.status(status).json({ error: message });
}
