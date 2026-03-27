export type SyncEntityType = 'customer' | 'vendor' | 'item' | 'invoice' | 'bill';

export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncPayload {
  forceUpdate?: boolean;
  source?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface QuickBooksErrorInfo {
  category: 'auth' | 'rate_limit' | 'validation' | 'transient' | 'unknown';
  statusCode?: number;
  code?: string;
  message: string;
  raw?: unknown;
}
