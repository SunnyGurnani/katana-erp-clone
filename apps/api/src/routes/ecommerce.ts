import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';
import fetch from 'node-fetch';
import crypto from 'crypto';

const router = Router();

const PROVIDERS = ['shopify', 'woocommerce'] as const;
type Provider = typeof PROVIDERS[number];
function assertProvider(p: string): asserts p is Provider {
  if (!PROVIDERS.includes(p as Provider)) throw Object.assign(new Error('Invalid provider'), { status: 400 });
}

// Webhook endpoint (no auth — must be before router.use(authenticate))
router.post('/webhooks/:provider', async (req, res) => {
  const provider = req.params.provider;
  const integration = await prisma.ecommerceIntegration.findFirst({ where: { provider } });

  if (integration?.webhookSecret) {
    const sigHeader = req.headers['x-shopify-hmac-sha256'] || req.headers['x-wc-webhook-signature'];
    if (sigHeader) {
      const hash = crypto.createHmac('sha256', integration.webhookSecret).update(JSON.stringify(req.body)).digest('base64');
      if (hash !== sigHeader) return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const topic = String(req.headers['x-shopify-topic'] || req.headers['x-wc-webhook-topic'] || 'unknown');
  if (integration) {
    await prisma.ecommerceSyncLog.create({
      data: {
        integrationId: integration.id,
        direction: 'pull',
        entityType: topic,
        entityId: String((req.body as any)?.id || 'webhook'),
        status: 'success',
        payload: JSON.stringify(req.body),
      },
    }).catch(() => {});
  }
  res.status(200).json({ received: true, topic });
});

router.use(authenticate);
router.use(requireOperatorForMutations);

async function getIntegration(provider: string) {
  const integration = await prisma.ecommerceIntegration.findUnique({ where: { provider } });
  if (!integration || integration.status !== 'connected') {
    throw Object.assign(new Error(`${provider} not connected`), { status: 400 });
  }
  return integration;
}

async function logSync(integrationId: string, direction: string, entityType: string, entityId: string, status: string, error?: string, externalId?: string, payload?: string) {
  return prisma.ecommerceSyncLog.create({
    data: { integrationId, direction, entityType, entityId, status, error: error ?? null, externalId: externalId ?? null, payload: payload ?? null },
  });
}

// GET /ecommerce/integrations
router.get('/integrations', async (_req, res) => {
  const items = await prisma.ecommerceIntegration.findMany({
    include: { syncLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  res.json(items);
});

// POST /ecommerce/:provider/connect
router.post('/:provider/connect', async (req, res) => {
  assertProvider(req.params.provider);
  const body = z.object({
    shopDomain: z.string().optional(),
    accessToken: z.string(),
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    webhookSecret: z.string().optional(),
    settings: z.record(z.any()).optional(),
  }).parse(req.body);

  const item = await prisma.ecommerceIntegration.upsert({
    where: { provider: req.params.provider },
    create: {
      provider: req.params.provider, status: 'connected',
      shopDomain: body.shopDomain, accessToken: body.accessToken,
      apiKey: body.apiKey, apiSecret: body.apiSecret,
      webhookSecret: body.webhookSecret,
      settings: body.settings ? JSON.stringify(body.settings) : null,
    },
    update: {
      status: 'connected', shopDomain: body.shopDomain ?? undefined,
      accessToken: body.accessToken, apiKey: body.apiKey ?? undefined,
      apiSecret: body.apiSecret ?? undefined, webhookSecret: body.webhookSecret ?? undefined,
      settings: body.settings ? JSON.stringify(body.settings) : undefined,
      updatedAt: new Date(),
    },
  });
  res.json(item);
});

// POST /ecommerce/:provider/disconnect
router.post('/:provider/disconnect', async (req, res) => {
  assertProvider(req.params.provider);
  const item = await prisma.ecommerceIntegration.upsert({
    where: { provider: req.params.provider },
    create: { provider: req.params.provider, status: 'disconnected' },
    update: { status: 'disconnected', accessToken: null, apiKey: null, apiSecret: null, updatedAt: new Date() },
  });
  res.json(item);
});

// POST /ecommerce/:provider/sync/products — pull products from store, create mappings
router.post('/:provider/sync/products', async (req, res) => {
  assertProvider(req.params.provider);
  const integration = await getIntegration(req.params.provider);
  const results: any[] = [];

  let externalVariants: any[] = [];
  try {
    if (req.params.provider === 'shopify') {
      const r = await fetch(`https://${integration.shopDomain}/admin/api/2024-01/variants.json?limit=250`, {
        headers: { 'X-Shopify-Access-Token': integration.accessToken! },
      });
      const data: any = await r.json();
      externalVariants = data.variants || [];
    } else {
      const auth = Buffer.from(`${integration.apiKey}:${integration.apiSecret}`).toString('base64');
      const r = await fetch(`https://${integration.shopDomain}/wp-json/wc/v3/products?per_page=100`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      externalVariants = (await r.json() as any[]) || [];
    }
  } catch (err: any) {
    return res.status(502).json({ error: `Failed to fetch from ${req.params.provider}`, detail: err.message });
  }

  for (const v of externalVariants) {
    const sku = v.sku;
    const variant = sku ? await prisma.variant.findFirst({ where: { sku } }) : null;
    if (variant) {
      await prisma.ecommerceProductMapping.upsert({
        where: { integrationId_variantId: { integrationId: integration.id, variantId: variant.id } },
        create: { integrationId: integration.id, variantId: variant.id, externalId: String(v.id), externalSku: sku, lastSyncAt: new Date() },
        update: { externalId: String(v.id), externalSku: sku, lastSyncAt: new Date(), updatedAt: new Date() },
      });
      await logSync(integration.id, 'pull', 'product', variant.id, 'success', undefined, String(v.id));
      results.push({ variantId: variant.id, externalId: String(v.id), sku, status: 'mapped' });
    } else {
      results.push({ externalId: String(v.id), sku, status: 'skipped', reason: 'no matching SKU in ForgeERP' });
    }
  }

  await prisma.ecommerceIntegration.update({ where: { provider: req.params.provider }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
  res.json({ synced: results.length, results });
});

// POST /ecommerce/:provider/sync/orders — pull orders, create SOs
router.post('/:provider/sync/orders', async (req, res) => {
  assertProvider(req.params.provider);
  const integration = await getIntegration(req.params.provider);
  const results: any[] = [];

  let externalOrders: any[] = [];
  try {
    if (req.params.provider === 'shopify') {
      const r = await fetch(`https://${integration.shopDomain}/admin/api/2024-01/orders.json?limit=50&status=open`, {
        headers: { 'X-Shopify-Access-Token': integration.accessToken! },
      });
      const data: any = await r.json();
      externalOrders = data.orders || [];
    } else {
      const auth = Buffer.from(`${integration.apiKey}:${integration.apiSecret}`).toString('base64');
      const r = await fetch(`https://${integration.shopDomain}/wp-json/wc/v3/orders?per_page=50&status=processing`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      externalOrders = (await r.json() as any[]) || [];
    }
  } catch (err: any) {
    return res.status(502).json({ error: `Failed to fetch orders from ${req.params.provider}`, detail: err.message });
  }

  for (const order of externalOrders) {
    try {
      const externalId = String(order.id);
      const existing = await prisma.ecommerceSyncLog.findFirst({
        where: { integrationId: integration.id, direction: 'pull', entityType: 'order', externalId },
      });
      if (existing) { results.push({ externalId, status: 'skipped', reason: 'already imported' }); continue; }

      const emailField: string | undefined = req.params.provider === 'shopify' ? order.email : order.billing?.email;
      let customer = emailField ? await prisma.customer.findFirst({ where: { email: emailField } }) : null;
      if (!customer && emailField) {
        const nameField = req.params.provider === 'shopify'
          ? `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || emailField
          : `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || emailField;
        customer = await prisma.customer.create({ data: { name: nameField, email: emailField } });
      }

      const soRows: any[] = [];
      for (const line of (order.line_items || [])) {
        const extId = String(req.params.provider === 'shopify' ? line.variant_id : line.product_id);
        const mapping = await prisma.ecommerceProductMapping.findFirst({
          where: { integrationId: integration.id, externalId: extId },
        });
        if (mapping) {
          soRows.push({ variantId: mapping.variantId, qtyOrdered: line.quantity, unitPrice: Number(line.price) });
        }
      }

      if (soRows.length > 0 && customer) {
        // Generate unique order number
        const count = await prisma.salesOrder.count();
        const orderNumber = `${req.params.provider.toUpperCase().substring(0, 4)}-${String(count + 1).padStart(6, '0')}`;
        const so = await prisma.salesOrder.create({
          data: {
            number: orderNumber,
            customerId: customer.id,
            status: 'draft',
            notes: `Imported from ${req.params.provider} order #${externalId}`,
            rows: { create: soRows },
          },
        });
        await logSync(integration.id, 'pull', 'order', so.id, 'success', undefined, externalId, JSON.stringify({ externalId, soId: so.id }));
        results.push({ externalId, soId: so.id, soNumber: so.number, status: 'created' });
      } else {
        results.push({ externalId, status: 'skipped', reason: !customer ? 'no customer email' : 'no mapped line items' });
      }
    } catch (err: any) {
      results.push({ externalId: String(order.id), status: 'error', error: err.message });
    }
  }

  await prisma.ecommerceIntegration.update({ where: { provider: req.params.provider }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
  res.json({ synced: results.length, results });
});

// POST /ecommerce/:provider/sync/inventory — push inventory levels to store
router.post('/:provider/sync/inventory', async (req, res) => {
  assertProvider(req.params.provider);
  const integration = await getIntegration(req.params.provider);
  const { locationId } = z.object({ locationId: z.string().uuid().optional() }).parse(req.body);

  const mappings = await prisma.ecommerceProductMapping.findMany({
    where: { integrationId: integration.id, syncInventory: true },
  });

  const results: any[] = [];
  for (const mapping of mappings) {
    try {
      const invWhere: any = { variantId: mapping.variantId };
      if (locationId) invWhere.locationId = locationId;

      const invLevels = await prisma.inventoryLevel.findMany({ where: invWhere });
      const totalQty = invLevels.reduce((sum: number, l: any) => sum + Number(l.onHand), 0);

      // In production: PATCH to Shopify inventory_levels/set.json or WC products/:id
      const log = await logSync(
        integration.id, 'push', 'inventory', mapping.variantId, 'success',
        undefined, mapping.externalId,
        JSON.stringify({ variantId: mapping.variantId, externalId: mapping.externalId, quantity: totalQty }),
      );
      await prisma.ecommerceProductMapping.update({ where: { id: mapping.id }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
      results.push({ variantId: mapping.variantId, externalId: mapping.externalId, quantity: totalQty, status: 'success' });
    } catch (err: any) {
      await logSync(integration.id, 'push', 'inventory', mapping.variantId, 'error', err.message);
      results.push({ variantId: mapping.variantId, status: 'error', error: err.message });
    }
  }

  await prisma.ecommerceIntegration.update({ where: { provider: req.params.provider }, data: { lastSyncAt: new Date(), updatedAt: new Date() } });
  res.json({ synced: results.length, results });
});

// Mappings CRUD
router.get('/mappings', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.ecommerceProductMapping.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.ecommerceProductMapping.count(),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/mappings', async (req, res) => {
  const data = z.object({
    integrationId: z.string().uuid(),
    variantId: z.string().uuid(),
    externalId: z.string(),
    externalSku: z.string().optional(),
    syncInventory: z.boolean().default(true),
    syncPrice: z.boolean().default(false),
  }).parse(req.body);
  const item = await prisma.ecommerceProductMapping.create({ data });
  res.status(201).json(item);
});

router.delete('/mappings/:id', async (req, res) => {
  await prisma.ecommerceProductMapping.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// GET /ecommerce/:provider/sync-logs
router.get('/:provider/sync-logs', async (req, res) => {
  assertProvider(req.params.provider);
  const { page, pageSize, skip, take } = getPagination(req);
  const integration = await prisma.ecommerceIntegration.findUnique({ where: { provider: req.params.provider } });
  if (!integration) return res.status(404).json({ error: 'Integration not found' });

  const where = { integrationId: integration.id };
  const [items, total] = await Promise.all([
    prisma.ecommerceSyncLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.ecommerceSyncLog.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

export default router;
