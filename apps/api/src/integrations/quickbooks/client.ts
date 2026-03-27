import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import fetch from 'node-fetch';
import { env } from '../../env';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import type { AccountingIntegration } from '@prisma/client';
import type { QuickBooksTokenResponse } from './types';

const QUICKBOOKS_BASE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QUICKBOOKS_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function getConfiguredScopes(): string[] {
  return (env.QUICKBOOKS_SCOPES || 'com.intuit.quickbooks.accounting')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function buildBasicAuthHeader(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

function getEncryptionKey(): Buffer {
  const keyMaterial = env.INTEGRATION_ENCRYPTION_KEY;
  if (!keyMaterial) throw Object.assign(new Error('Missing INTEGRATION_ENCRYPTION_KEY'), { status: 500 });
  return createHash('sha256').update(keyMaterial).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM for at-rest storage.
 */
export function encryptSecret(plain: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

/**
 * Decrypt token previously encrypted with encryptSecret.
 */
export function decryptSecret(cipherText: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = cipherText.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw Object.assign(new Error('Invalid encrypted token format'), { status: 500 });
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Build QuickBooks OAuth authorization URL.
 */
export function buildAuthorizationUrl(state: string): string {
  const query = new URLSearchParams({
    client_id: env.QUICKBOOKS_CLIENT_ID,
    redirect_uri: env.QUICKBOOKS_REDIRECT_URI,
    response_type: 'code',
    scope: getConfiguredScopes().join(' '),
    state,
  });
  return `${QUICKBOOKS_BASE_URL}?${query.toString()}`;
}

/**
 * Exchange OAuth authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<QuickBooksTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.QUICKBOOKS_REDIRECT_URI,
  });
  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${buildBasicAuthHeader(env.QUICKBOOKS_CLIENT_ID, env.QUICKBOOKS_CLIENT_SECRET)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({ status: response.status, errorBody }, 'QuickBooks token exchange failed');
    throw Object.assign(new Error('QuickBooks token exchange failed'), { status: 502 });
  }
  return (await response.json()) as QuickBooksTokenResponse;
}

/**
 * Refresh an access token with a stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<QuickBooksTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${buildBasicAuthHeader(env.QUICKBOOKS_CLIENT_ID, env.QUICKBOOKS_CLIENT_SECRET)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({ status: response.status, errorBody }, 'QuickBooks token refresh failed');
    throw Object.assign(new Error('QuickBooks token refresh failed'), { status: 502 });
  }

  return (await response.json()) as QuickBooksTokenResponse;
}

/**
 * Revoke an access or refresh token at Intuit.
 */
export async function revokeToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token });
  const response = await fetch(QUICKBOOKS_REVOKE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${buildBasicAuthHeader(env.QUICKBOOKS_CLIENT_ID, env.QUICKBOOKS_CLIENT_SECRET)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.warn({ status: response.status, errorBody }, 'QuickBooks token revoke returned non-success');
  }
}

/**
 * Ensure stored integration has a valid token; refresh if near expiry.
 */
export async function ensureQuickBooksAccessToken(
  integration: AccountingIntegration,
): Promise<{ integration: AccountingIntegration; accessToken: string; refreshed: boolean }> {
  if (!integration.accessToken || !integration.refreshToken) {
    throw Object.assign(new Error('QuickBooks integration is missing tokens'), { status: 400 });
  }

  const now = Date.now();
  const expiresAt = integration.tokenExpiry?.getTime() ?? 0;
  const needsRefresh = !expiresAt || expiresAt - now <= TOKEN_REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return {
      integration,
      accessToken: decryptSecret(integration.accessToken),
      refreshed: false,
    };
  }

  const decryptedRefresh = decryptSecret(integration.refreshToken);
  const refreshedTokens = await refreshAccessToken(decryptedRefresh);
  const updated = await prisma.accountingIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: encryptSecret(refreshedTokens.access_token),
      refreshToken: refreshedTokens.refresh_token ? encryptSecret(refreshedTokens.refresh_token) : integration.refreshToken,
      tokenExpiry: new Date(Date.now() + refreshedTokens.expires_in * 1000),
      status: 'connected',
    },
  });

  return {
    integration: updated,
    accessToken: refreshedTokens.access_token,
    refreshed: true,
  };
}
