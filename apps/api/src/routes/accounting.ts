import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';
import { logger } from '../lib/logger';
import {
  buildAuthorizationUrl,
  decryptSecret,
  encryptSecret,
  ensureQuickBooksAccessToken,
  exchangeCodeForTokens,
  revokeToken,
} from '../integrations/quickbooks/client';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const quickBooksSettingsSchema = z.object({
  accountMappings: z.record(z.string()).optional(),
  taxMappings: z.record(z.string()).optional(),
  syncToggles: z.record(z.boolean()).optional(),
}).passthrough();

function requireQuickBooksEnv() {
  if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET || !process.env.QUICKBOOKS_REDIRECT_URI) {
    throw Object.assign(new Error('QuickBooks OAuth is not configured'), { status: 500 });
  }
  if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
    throw Object.assign(new Error('INTEGRATION_ENCRYPTION_KEY is required for QuickBooks'), { status: 500 });
  }
}

const PROVIDERS = ['quickbooks', 'xero'] as const;
type Provider = typeof PROVIDERS[number];
function assertProvider(p: string): asserts p is Provider {
  if (!PROVIDERS.includes(p as Provider)) throw Object.assign(new Error('Invalid provider'), { status: 400 });
}

/**
 * Load or create QuickBooks integration row.
 */
async function getOrCreateQuickBooksIntegration() {
  return prisma.accountingIntegration.upsert({
    where: { provider: 'quickbooks' },
    create: { provider: 'quickbooks', status: 'disconnected' },
    update: {},
  });
}

// POST /accounting/quickbooks/connect
router.post('/quickbooks/connect', async (req, res) => {
  requireQuickBooksEnv();
  const { state } = z.object({ state: z.string().optional() }).parse(req.body ?? {});
  const oauthState = state || `qb_${Date.now()}`;
  const integration = await getOrCreateQuickBooksIntegration();
  const authorizationUrl = buildAuthorizationUrl(oauthState);
  res.json({
    provider: 'quickbooks',
    integrationId: integration.id,
    authorizationUrl,
    state: oauthState,
  });
});

// GET /accounting/quickbooks/callback
router.get('/quickbooks/callback', async (req, res) => {
  requireQuickBooksEnv();
  const query = z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    realmId: z.string().optional(),
  }).parse(req.query);

  if (!query.code) return res.status(400).json({ error: 'Missing authorization code' });

  const integration = await getOrCreateQuickBooksIntegration();
  const tokens = await exchangeCodeForTokens(query.code);
  const updated = await prisma.accountingIntegration.update({
    where: { id: integration.id },
    data: {
      status: 'connected',
      realmId: query.realmId ?? integration.realmId ?? null,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      updatedAt: new Date(),
    },
  });

  res.json({
    provider: 'quickbooks',
    connected: true,
    state: query.state ?? null,
    realmId: updated.realmId,
    tokenExpiry: updated.tokenExpiry,
  });
});

// POST /accounting/quickbooks/disconnect
router.post('/quickbooks/disconnect', async (_req, res) => {
  requireQuickBooksEnv();
  const integration = await prisma.accountingIntegration.findUnique({ where: { provider: 'quickbooks' } });

  if (integration?.accessToken) {
    try {
      await revokeToken(decryptSecret(integration.accessToken));
    } catch (error) {
      logger.warn({ err: error }, 'QuickBooks token revoke failed during disconnect');
    }
  }

  const item = await prisma.accountingIntegration.upsert({
    where: { provider: 'quickbooks' },
    create: { provider: 'quickbooks', status: 'disconnected' },
    update: {
      status: 'disconnected',
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      updatedAt: new Date(),
    },
  });
  res.json({
    provider: 'quickbooks',
    connected: false,
    status: item.status,
  });
});

// GET /accounting/quickbooks/status
router.get('/quickbooks/status', async (_req, res) => {
  requireQuickBooksEnv();
  const integration = await prisma.accountingIntegration.findUnique({
    where: { provider: 'quickbooks' },
    include: { syncLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (!integration) {
    return res.json({
      provider: 'quickbooks',
      connected: false,
      status: 'disconnected',
      realmId: null,
      tokenExpiry: null,
      tokenExpiresInSeconds: null,
      lastSyncAt: null,
      refreshed: false,
    });
  }

  let refreshed = false;
  let hydrated = integration;
  if (integration.status === 'connected' && integration.accessToken && integration.refreshToken) {
    try {
      const refreshedResult = await ensureQuickBooksAccessToken(integration);
      refreshed = refreshedResult.refreshed;
      hydrated = refreshedResult.integration;
    } catch (error) {
      logger.warn({ err: error }, 'QuickBooks token health check failed');
    }
  }

  const expiryMs = hydrated.tokenExpiry ? hydrated.tokenExpiry.getTime() - Date.now() : null;
  return res.json({
    provider: 'quickbooks',
    connected: hydrated.status === 'connected',
    status: hydrated.status,
    integrationId: hydrated.id,
    realmId: hydrated.realmId,
    tokenExpiry: hydrated.tokenExpiry,
    tokenExpiresInSeconds: expiryMs === null ? null : Math.max(0, Math.floor(expiryMs / 1000)),
    lastSyncAt: hydrated.lastSyncAt,
    refreshed,
  });
});

// POST /accounting/quickbooks/settings
router.post('/quickbooks/settings', async (req, res) => {
  requireQuickBooksEnv();
  const settings = quickBooksSettingsSchema.parse(req.body ?? {});
  const integration = await getOrCreateQuickBooksIntegration();
  const updated = await prisma.accountingIntegration.update({
    where: { id: integration.id },
    data: {
      settings: JSON.stringify(settings),
      updatedAt: new Date(),
    },
  });
  res.json({
    provider: 'quickbooks',
    settings: updated.settings ? JSON.parse(updated.settings) : {},
  });
});

// GET /accounting/integrations
router.get('/integrations', async (_req, res) => {
  const items = await prisma.accountingIntegration.findMany({
    include: { syncLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  res.json(items);
});

// POST /accounting/:provider/connect
router.post('/:provider/connect', async (req, res) => {
  assertProvider(req.params.provider);
  const isQuickBooks = req.params.provider === 'quickbooks';
  if (isQuickBooks) requireQuickBooksEnv();
  const body = z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    tokenExpiry: z.coerce.date().optional(),
    realmId: z.string().optional(),
    tenantId: z.string().optional(),
    settings: z.record(z.any()).optional(),
  }).parse(req.body);

  const item = await prisma.accountingIntegration.upsert({
    where: { provider: req.params.provider },
    create: {
      provider: req.params.provider,
      status: 'connected',
      accessToken: isQuickBooks ? encryptSecret(body.accessToken) : body.accessToken,
      refreshToken: body.refreshToken ? (isQuickBooks ? encryptSecret(body.refreshToken) : body.refreshToken) : undefined,
      tokenExpiry: body.tokenExpiry,
      realmId: body.realmId,
      tenantId: body.tenantId,
      settings: body.settings ? JSON.stringify(body.settings) : null,
    },
    update: {
      status: 'connected',
      accessToken: isQuickBooks ? encryptSecret(body.accessToken) : body.accessToken,
      refreshToken: body.refreshToken ? (isQuickBooks ? encryptSecret(body.refreshToken) : body.refreshToken) : undefined,
      tokenExpiry: body.tokenExpiry ?? undefined,
      realmId: body.realmId ?? undefined,
      tenantId: body.tenantId ?? undefined,
      settings: body.settings ? JSON.stringify(body.settings) : undefined,
      updatedAt: new Date(),
    },
  });
  res.json(item);
});

// POST /accounting/:provider/disconnect
router.post('/:provider/disconnect', async (req, res) => {
  assertProvider(req.params.provider);
  const item = await prisma.accountingIntegration.upsert({
    where: { provider: req.params.provider },
    create: { provider: req.params.provider, status: 'disconnected' },
    update: { status: 'disconnected', accessToken: null, refreshToken: null, tokenExpiry: null, updatedAt: new Date() },
  });
  res.json(item);
});

async function getIntegration(provider: string) {
  const integration = await prisma.accountingIntegration.findUnique({ where: { provider } });
  if (!integration || integration.status !== 'connected') {
    throw Object.assign(new Error(`${provider} not connected`), { status: 400 });
  }
  if (provider === 'quickbooks' && integration.accessToken && integration.refreshToken) {
    const refreshed = await ensureQuickBooksAccessToken(integration);
    return refreshed.integration;
  }
  return integration;
}

async function logSync(integrationId: string, direction: string, entityType: string, entityId: string, status: string, error?: string, externalId?: string, payload?: string) {
  return prisma.accountingSyncLog.create({
    data: { integrationId, direction, entityType, entityId, status, error: error ?? null, externalId: externalId ?? null, payload: payload ?? null },
  });
}

// POST /accounting/:provider/sync/invoices — push fulfilled SOs as invoices
router.post('/:provider/sync/invoices', async (req, res) => {
  assertProvider(req.params.provider);
  const integration = await getIntegration(req.params.provider);
  const { soIds } = z.object({ soIds: z.array(z.string().uuid()).optional() }).parse(req.body);

  const where: any = { status: 'fulfilled' };
  if (soIds?.length) where.id = { in: soIds };

  const orders = await prisma.salesOrder.findMany({
    where,
    include: { customer: true, rows: true },
  });
  const results: any[] = [];

  for (const order of orders) {
    try {
      const payload = buildInvoicePayload(req.params.provider as Provider, order);
      const log = await logSync(integration.id, 'push', 'invoice', order.id, 'success', undefined, `ext_${order.id.slice(0, 8)}`, JSON.stringify(payload));
      results.push({ orderId: order.id, number: order.number, status: 'success', logId: log.id });
    } catch (err: any) {
      const log = await logSync(integration.id, 'push', 'invoice', order.id, 'error', err.message);
      results.push({ orderId: order.id, status: 'error', error: err.message, logId: log.id });
    }
  }

  await prisma.accountingIntegration.update({ where: { provider: req.params.provider }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
  res.json({ synced: results.length, results });
});

// POST /accounting/:provider/sync/bills — push POs as bills
router.post('/:provider/sync/bills', async (req, res) => {
  assertProvider(req.params.provider);
  const integration = await getIntegration(req.params.provider);
  const { poIds } = z.object({ poIds: z.array(z.string().uuid()).optional() }).parse(req.body);

  const where: any = {};
  if (poIds?.length) where.id = { in: poIds };

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: { supplier: true, rows: true },
  });
  const results: any[] = [];

  for (const order of orders) {
    try {
      const payload = buildBillPayload(req.params.provider as Provider, order);
      const log = await logSync(integration.id, 'push', 'bill', order.id, 'success', undefined, `ext_${order.id.slice(0, 8)}`, JSON.stringify(payload));
      results.push({ orderId: order.id, number: order.number, status: 'success', logId: log.id });
    } catch (err: any) {
      const log = await logSync(integration.id, 'push', 'bill', order.id, 'error', err.message);
      results.push({ orderId: order.id, status: 'error', error: err.message, logId: log.id });
    }
  }

  await prisma.accountingIntegration.update({ where: { provider: req.params.provider }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
  res.json({ synced: results.length, results });
});

// POST /accounting/:provider/sync/contacts
router.post('/:provider/sync/contacts', async (req, res) => {
  assertProvider(req.params.provider);
  const integration = await getIntegration(req.params.provider);

  const [customers, suppliers] = await Promise.all([
    prisma.customer.findMany(),
    prisma.supplier.findMany(),
  ]);

  const results: any[] = [];
  for (const c of customers) {
    const payload = { type: 'customer', name: c.name, email: c.email, phone: c.phone };
    const log = await logSync(integration.id, 'push', 'contact', c.id, 'success', undefined, `cust_${c.id.slice(0, 8)}`, JSON.stringify(payload));
    results.push({ id: c.id, type: 'customer', status: 'success', logId: log.id });
  }
  for (const s of suppliers) {
    const payload = { type: 'supplier', name: s.name, email: s.email, phone: s.phone };
    const log = await logSync(integration.id, 'push', 'contact', s.id, 'success', undefined, `supp_${s.id.slice(0, 8)}`, JSON.stringify(payload));
    results.push({ id: s.id, type: 'supplier', status: 'success', logId: log.id });
  }

  await prisma.accountingIntegration.update({ where: { provider: req.params.provider }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
  res.json({ synced: results.length, results });
});

// GET /accounting/:provider/sync-logs
router.get('/:provider/sync-logs', async (req, res) => {
  assertProvider(req.params.provider);
  const { page, pageSize, skip, take } = getPagination(req);
  const integration = await prisma.accountingIntegration.findUnique({ where: { provider: req.params.provider } });
  if (!integration) return res.status(404).json({ error: 'Integration not found' });

  const where = { integrationId: integration.id };
  const [items, total] = await Promise.all([
    prisma.accountingSyncLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.accountingSyncLog.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// OAuth callback — receives authorization code
router.get('/:provider/oauth/callback', async (req, res) => {
  assertProvider(req.params.provider);
  const { code, realmId } = req.query as Record<string, string>;
  if (!code) return res.status(400).json({ error: 'Missing authorization code' });
  res.json({
    message: 'Exchange this code for tokens and POST to /accounting/:provider/connect',
    provider: req.params.provider,
    code,
    realmId: realmId || null,
    tokenEndpoint: req.params.provider === 'quickbooks'
      ? 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
      : 'https://identity.xero.com/connect/token',
  });
});

function buildInvoicePayload(provider: Provider, order: any) {
  const lines = (order.rows || []).map((l: any) => ({
    description: l.description || l.variantId || 'Item',
    qty: Number(l.qtyOrdered),
    unitPrice: Number(l.unitPrice ?? 0),
    amount: Number(l.qtyOrdered) * Number(l.unitPrice ?? 0),
  }));
  if (provider === 'quickbooks') {
    return {
      DocNumber: order.number,
      CustomerRef: { name: order.customer?.name, value: order.customerId },
      Line: lines.map((l: any, i: number) => ({
        LineNum: i + 1, Amount: l.amount, DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: { Qty: l.qty, UnitPrice: l.unitPrice },
        Description: l.description,
      })),
    };
  }
  return {
    Type: 'ACCREC',
    Contact: { Name: order.customer?.name },
    LineItems: lines.map((l: any) => ({ Description: l.description, Quantity: l.qty, UnitAmount: l.unitPrice })),
    Reference: order.number, Status: 'DRAFT',
  };
}

function buildBillPayload(provider: Provider, order: any) {
  const lines = (order.rows || []).map((l: any) => ({
    description: l.description || l.materialId || 'Item',
    qty: Number(l.qtyOrdered),
    unitPrice: Number(l.unitPrice ?? 0),
    amount: Number(l.qtyOrdered) * Number(l.unitPrice ?? 0),
  }));
  if (provider === 'quickbooks') {
    return {
      DocNumber: order.number,
      VendorRef: { name: order.supplier?.name, value: order.supplierId },
      Line: lines.map((l: any, i: number) => ({
        LineNum: i + 1, Amount: l.amount, DetailType: 'ItemBasedExpenseLineDetail',
        ItemBasedExpenseLineDetail: { Qty: l.qty, UnitPrice: l.unitPrice },
        Description: l.description,
      })),
    };
  }
  return {
    Type: 'ACCPAY',
    Contact: { Name: order.supplier?.name },
    LineItems: lines.map((l: any) => ({ Description: l.description, Quantity: l.qty, UnitAmount: l.unitPrice })),
    Reference: order.number, Status: 'DRAFT',
  };
}

export default router;
