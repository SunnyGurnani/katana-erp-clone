import fetch from 'node-fetch';
import { env } from '../../env';
import type { AccountingIntegration } from '@prisma/client';
import { ensureQuickBooksAccessToken } from './client';

function qboHost(): string {
  return env.QUICKBOOKS_ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

export async function qboRequest<T = Record<string, unknown>>(
  integration: AccountingIntegration,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: T; integration: AccountingIntegration; accessToken: string }> {
  const { accessToken, integration: hydrated } = await ensureQuickBooksAccessToken(integration);
  const realmId = hydrated.realmId;
  if (!realmId) {
    throw Object.assign(new Error('QuickBooks company (realmId) is not set. Reconnect QuickBooks.'), { status: 400 });
  }

  const url = `${qboHost()}/v3/company/${realmId}${path}${path.includes('?') ? '&' : '?'}minorversion=75`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json: any = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  if (!response.ok) {
    const detail = json?.Fault?.Error?.[0]?.Message || json?.error || text || response.statusText;
    throw Object.assign(new Error(`QuickBooks API error: ${detail}`), {
      status: response.status >= 500 ? 502 : 400,
      qbo: json,
    });
  }

  return { data: json as T, integration: hydrated, accessToken };
}

export async function upsertEntityMapping(
  integrationId: string,
  entityType: string,
  localEntityId: string,
  externalEntityId: string,
  syncToken?: string | null,
) {
  const { prisma } = await import('../../lib/prisma');
  return prisma.accountingEntityMapping.upsert({
    where: {
      integrationId_entityType_localEntityId: { integrationId, entityType, localEntityId },
    },
    create: {
      integrationId,
      entityType,
      localEntityId,
      externalEntityId,
      syncToken: syncToken ?? null,
      lastSyncedAt: new Date(),
    },
    update: {
      externalEntityId,
      syncToken: syncToken ?? undefined,
      lastSyncedAt: new Date(),
    },
  });
}

export async function getEntityMapping(
  integrationId: string,
  entityType: string,
  localEntityId: string,
) {
  const { prisma } = await import('../../lib/prisma');
  return prisma.accountingEntityMapping.findUnique({
    where: {
      integrationId_entityType_localEntityId: { integrationId, entityType, localEntityId },
    },
  });
}
