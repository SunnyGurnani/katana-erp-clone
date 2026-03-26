import { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory sliding-window rate limiter.
 * For production with multiple replicas, swap to Redis-backed store.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Prune expired entries every 60 s to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60_000).unref();

export interface RateLimitOptions {
  /** Maximum requests per window (default 100) */
  max?: number;
  /** Window size in milliseconds (default 60 000 = 1 min) */
  windowMs?: number;
}

export function rateLimit(opts: RateLimitOptions = {}) {
  const max = opts.max ?? 100;
  const windowMs = opts.windowMs ?? 60_000;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
    } else {
      entry.count++;
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    next();
  };
}
