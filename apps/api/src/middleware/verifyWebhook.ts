import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../env';

const SIG_HEADER = 'x-webhook-signature';

function hexToBuf(hex: string): Buffer | null {
  const s = hex.trim().replace(/^sha256=/i, '');
  if (!/^[0-9a-f]+$/i.test(s) || s.length % 2 !== 0) return null;
  return Buffer.from(s, 'hex');
}

/**
 * Verifies HMAC-SHA256(rawBody, WEBHOOK_SECRET) against X-Webhook-Signature (hex).
 * Mount on routes that use express.raw / raw body (see webhooks inbound).
 */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction): void {
  const secret = env.WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Webhook receiver not configured (WEBHOOK_SECRET)' });
    return;
  }

  const raw = req.body;
  if (!Buffer.isBuffer(raw)) {
    res.status(400).json({ error: 'Expected raw body buffer' });
    return;
  }

  const headerVal = req.headers[SIG_HEADER];
  const provided = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (!provided || typeof provided !== 'string') {
    res.status(401).json({ error: 'Missing X-Webhook-Signature' });
    return;
  }

  const expected = createHmac('sha256', secret).update(raw).digest();
  const candidate = hexToBuf(provided);
  if (!candidate || candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  next();
}
