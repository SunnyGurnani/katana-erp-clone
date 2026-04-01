import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal } from '../lib/metrics';

function routeLabel(req: Request): string {
  if (req.route?.path) {
    const base = req.baseUrl || '';
    return `${base}${req.route.path}` || req.originalUrl.split('?')[0];
  }
  return req.originalUrl.split('?')[0] || '/';
}

export function metricsHttpMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    const method = req.method;
    const route = routeLabel(req);
    const status = String(res.statusCode);
    httpRequestsTotal.labels(method, route, status).inc();
  });
  next();
}
