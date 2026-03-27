export interface QuickBooksTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
}

export interface QuickBooksCallbackQuery {
  code?: string;
  state?: string;
  realmId?: string;
}

export interface QuickBooksConnectRequest {
  state?: string;
}

export interface QuickBooksSettings {
  accountMappings?: Record<string, string>;
  taxMappings?: Record<string, string>;
  syncToggles?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface QuickBooksStatusResponse {
  connected: boolean;
  integrationId: string | null;
  realmId: string | null;
  tokenExpiry: string | null;
  tokenExpiresInSeconds: number | null;
  lastSyncAt: string | null;
  refreshed: boolean;
  status: string;
}
