import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[HEADER];
  const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}
