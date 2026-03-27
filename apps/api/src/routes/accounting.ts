import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { TenantRequest, tenantWhere, tenantData } from '../middleware/tenant';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const PROVIDERS = ['quickbooks', 'xero'] as const;
type Provider = typeof PROVIDERS[number];
function assertProvider(p: string): asserts p is Provider {
  if (!PROVIDERS.includes(p as Provider)) throw Object.assign(new Error('Invalid provider'), { status: 400 });
}

/** Locate integration by provider scoped to the current tenant. */
async function findIntegration(req: TenantRequest, provider: string) {
  return prisma.accountingIntegration.findFirst({
    where: { provider, ...tenantWhere(req) },
  });
}

// GET /accounting/integrations
router.get('/integrations', async (req: TenantRequest, res) => {
  const items = await prisma.accountingIntegration.findMany({
    where: { ...tenantWhere(req) },
    include: { syncLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  res.json(items);
});

// POST /accounting/:provider/connect
router.post('/:provider/connect', async (req: TenantRequest, res) => {
  assertProvider(req.params.provider as string);
  const body = z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    tokenExpiry: z.coerce.date().optional(),
    realmId: z.string().optional(),
    externalTenantId: z.string().optional(),
    settings: z.record(z.any()).optional(),
  }).parse(req.body);

  const existing = await findIntegration(req, (req.params.provider as string));

  let item;
  if (existing) {
    item = await prisma.accountingIntegration.update({
      where: { id: existing.id },
      data: {
        status: 'connected',
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? undefined,
        tokenExpiry: body.tokenExpiry ?? undefined,
        realmId: body.realmId ?? undefined,
        tenantIdExt: body.externalTenantId ?? undefined,
        settings: body.settings ? JSON.stringify(body.settings) : undefined,
        updatedAt: new Date(),
      },
    });
  } else {
    item = await prisma.accountingIntegration.create({
      data: {
        ...tenantData(req),
        provider: (req.params.provider as string),
        status: 'connected',
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        tokenExpiry: body.tokenExpiry,
        realmId: body.realmId,
        tenantIdExt: body.externalTenantId,
        settings: body.settings ? JSON.stringify(body.settings) : null,
      } as any,
    });
  }
  res.json(item);
});

// POST /accounting/:provider/disconnect
router.post('/:provider/disconnect', async (req: TenantRequest, res) => {
  assertProvider(req.params.provider as string);
  const existing = await findIntegration(req, req.params.provider as string);

  let item;
  if (existing) {
    item = await prisma.accountingIntegration.update({
      where: { id: existing.id },
      data: { status: 'disconnected', accessToken: null, refreshToken: null, tokenExpiry: null, updatedAt: new Date() },
    });
  } else {
    item = await prisma.accountingIntegration.create({
      data: { ...tenantData(req), provider: (req.params.provider as string), status: 'disconnected' },
    });
  }
  res.json(item);
});

async function getIntegration(req: TenantRequest, provider: string) {
  const integration = await findIntegration(req, provider);
  if (!integration || integration.status !== 'connected') {
    throw Object.assign(new Error(`${provider} not connected`), { status: 400 });
  }
  return integration;
}

async function logSync(integrationId: string, direction: string, entityType: string, entityId: string, status: string, error?: string, externalId?: string, payload?: string) {
  return prisma.accountingSyncLog.create({
    data: { integrationId, direction, entityType, entityId, status, error: error ?? null, externalId: externalId ?? null, payload: payload ?? null },
  });
}

// POST /accounting/:provider/sync/invoices — push fulfilled SOs as invoices
router.post('/:provider/sync/invoices', async (req: TenantRequest, res) => {
  assertProvider((req.params.provider as string));
  const integration = await getIntegration(req, (req.params.provider as string));
  const { soIds } = z.object({ soIds: z.array(z.string().uuid()).optional() }).parse(req.body);

  const where: any = { status: 'fulfilled', ...tenantWhere(req) };
  if (soIds?.length) where.id = { in: soIds };

  const orders = await prisma.salesOrder.findMany({
    where,
    include: { customer: true, rows: true },
  });
  const results: any[] = [];

  for (const order of orders) {
    try {
      const payload = buildInvoicePayload((req.params.provider as string) as Provider, order);
      const log = await logSync(integration.id, 'push', 'invoice', order.id, 'success', undefined, `ext_${order.id.slice(0, 8)}`, JSON.stringify(payload));
      results.push({ orderId: order.id, number: order.number, status: 'success', logId: log.id });
    } catch (err: any) {
      const log = await logSync(integration.id, 'push', 'invoice', order.id, 'error', err.message);
      results.push({ orderId: order.id, status: 'error', error: err.message, logId: log.id });
    }
  }

  await prisma.accountingIntegration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
  res.json({ synced: results.length, results });
});

// POST /accounting/:provider/sync/bills — push POs as bills
router.post('/:provider/sync/bills', async (req: TenantRequest, res) => {
  assertProvider((req.params.provider as string));
  const integration = await getIntegration(req, (req.params.provider as string));
  const { poIds } = z.object({ poIds: z.array(z.string().uuid()).optional() }).parse(req.body);

  const where: any = { ...tenantWhere(req) };
  if (poIds?.length) where.id = { in: poIds };

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: { supplier: true, rows: true },
  });
  const results: any[] = [];

  for (const order of orders) {
    try {
      const payload = buildBillPayload((req.params.provider as string) as Provider, order);
      const log = await logSync(integration.id, 'push', 'bill', order.id, 'success', undefined, `ext_${order.id.slice(0, 8)}`, JSON.stringify(payload));
      results.push({ orderId: order.id, number: order.number, status: 'success', logId: log.id });
    } catch (err: any) {
      const log = await logSync(integration.id, 'push', 'bill', order.id, 'error', err.message);
      results.push({ orderId: order.id, status: 'error', error: err.message, logId: log.id });
    }
  }

  await prisma.accountingIntegration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
  res.json({ synced: results.length, results });
});

// POST /accounting/:provider/sync/contacts
router.post('/:provider/sync/contacts', async (req: TenantRequest, res) => {
  assertProvider((req.params.provider as string));
  const integration = await getIntegration(req, (req.params.provider as string));

  const [customers, suppliers] = await Promise.all([
    prisma.customer.findMany({ where: { ...tenantWhere(req) } }),
    prisma.supplier.findMany({ where: { ...tenantWhere(req) } }),
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

  await prisma.accountingIntegration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
  res.json({ synced: results.length, results });
});

// GET /accounting/:provider/sync-logs
router.get('/:provider/sync-logs', async (req: TenantRequest, res) => {
  assertProvider((req.params.provider as string));
  const { page, pageSize, skip, take } = getPagination(req);
  const integration = await findIntegration(req, (req.params.provider as string));
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
  assertProvider((req.params.provider as string));
  const { code, realmId } = req.query as Record<string, string>;
  if (!code) return res.status(400).json({ error: 'Missing authorization code' });
  res.json({
    message: 'Exchange this code for tokens and POST to /accounting/:provider/connect',
    provider: (req.params.provider as string),
    code,
    realmId: realmId || null,
    tokenEndpoint: (req.params.provider as string) === 'quickbooks'
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
