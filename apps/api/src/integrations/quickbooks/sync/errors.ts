import { QuickBooksErrorInfo } from './types';

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

export function normalizeQuickBooksError(error: unknown): QuickBooksErrorInfo {
  const obj = asObject(error);
  const statusCode = typeof obj.statusCode === 'number' ? obj.statusCode : undefined;
  const message = String(obj.message ?? 'Unknown QuickBooks error');
  const code = typeof obj.code === 'string' ? obj.code : undefined;

  if (statusCode === 401 || statusCode === 403) {
    return { category: 'auth', statusCode, code, message, raw: error };
  }
  if (statusCode === 429) {
    return { category: 'rate_limit', statusCode, code, message, raw: error };
  }
  if (statusCode && statusCode >= 500) {
    return { category: 'transient', statusCode, code, message, raw: error };
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNREFUSED') {
    return { category: 'transient', statusCode, code, message, raw: error };
  }
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return { category: 'validation', statusCode, code, message, raw: error };
  }
  return { category: 'unknown', statusCode, code, message, raw: error };
}

export function isRetryableQuickBooksError(error: unknown): boolean {
  const normalized = normalizeQuickBooksError(error);
  return normalized.category === 'rate_limit' || normalized.category === 'transient';
}
