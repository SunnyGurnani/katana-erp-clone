import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  return row.value as T;
}

async function setSetting(key: string, value: unknown) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}

router.get('/inventory-closing-date', async (_req, res) => {
  const date = await getSetting<string | null>('inventory_closing_date', null);
  res.json({ inventoryClosingDate: date });
});

router.patch('/inventory-closing-date', requireOperatorForMutations, async (req, res) => {
  const { inventoryClosingDate } = z
    .object({ inventoryClosingDate: z.string().nullable() })
    .parse(req.body);
  await setSetting('inventory_closing_date', inventoryClosingDate);
  res.json({ inventoryClosingDate });
});

router.get('/account-defaults', async (_req, res) => {
  const defaults = await getSetting('account_defaults', {
    defaultLocationId: null as string | null,
    defaultCurrency: 'USD',
    companyName: '',
    companyEmail: '',
  });
  res.json(defaults);
});

router.patch('/account-defaults', requireOperatorForMutations, async (req, res) => {
  const data = z
    .object({
      defaultLocationId: z.string().nullable().optional(),
      defaultCurrency: z.string().optional(),
      companyName: z.string().optional(),
      companyEmail: z.string().optional(),
    })
    .parse(req.body);
  const current = await getSetting('account_defaults', {
    defaultLocationId: null,
    defaultCurrency: 'USD',
    companyName: '',
    companyEmail: '',
  });
  const merged = { ...current, ...data };
  await setSetting('account_defaults', merged);
  res.json(merged);
});

const integrationConfigSchema = z.object({
  shopUrl: z.string().optional(),
  realmId: z.string().optional(),
  sellerId: z.string().optional(),
  portalId: z.string().optional(),
});

router.get('/integrations', async (_req, res) => {
  const integrations = await getSetting<Record<string, { connected: boolean; config?: Record<string, string> }>>(
    'integrations',
    {},
  );
  res.json(integrations);
});

router.patch('/integrations/:id', requireOperatorForMutations, async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = z
    .object({
      connected: z.boolean(),
      config: integrationConfigSchema.optional(),
    })
    .parse(req.body);
  const current = await getSetting<Record<string, { connected: boolean; config?: Record<string, string> }>>(
    'integrations',
    {},
  );
  const merged = {
    ...current,
    [id]: {
      connected: body.connected,
      config: body.config ?? current[id]?.config ?? {},
    },
  };
  await setSetting('integrations', merged);
  res.json(merged[id]);
});

const printTemplateIds = ['so', 'po', 'mo', 'invoice'] as const;

router.get('/print-templates', async (_req, res) => {
  const templates = await getSetting<Record<string, { name: string; headerText?: string; footerText?: string }>>(
    'print_templates',
    {
      so: { name: 'Sales order', headerText: '', footerText: '' },
      po: { name: 'Purchase order', headerText: '', footerText: '' },
      mo: { name: 'Manufacturing order', headerText: '', footerText: '' },
      invoice: { name: 'Invoice', headerText: '', footerText: '' },
    },
  );
  res.json(
    printTemplateIds.map((id) => ({
      id,
      ...templates[id],
    })),
  );
});

router.patch('/print-templates/:id', requireOperatorForMutations, async (req, res) => {
  const id = z.enum(printTemplateIds).parse(req.params.id);
  const patch = z
    .object({
      name: z.string().optional(),
      headerText: z.string().optional(),
      footerText: z.string().optional(),
    })
    .parse(req.body);
  const current = await getSetting<Record<string, { name: string; headerText?: string; footerText?: string }>>(
    'print_templates',
    {},
  );
  const merged = {
    ...current,
    [id]: { ...current[id], ...patch, name: patch.name ?? current[id]?.name ?? id },
  };
  await setSetting('print_templates', merged);
  res.json({ id, ...merged[id] });
});

router.get('/planning', async (_req, res) => {
  const planning = await getSetting('planning', { includeDemandForecast: false });
  res.json(planning);
});

router.patch('/planning', requireOperatorForMutations, async (req, res) => {
  const data = z.object({ includeDemandForecast: z.boolean().optional() }).parse(req.body);
  const current = await getSetting('planning', { includeDemandForecast: false });
  const merged = { ...current, ...data };
  await setSetting('planning', merged);
  res.json(merged);
});

router.get('/labs', async (_req, res) => {
  const labs = await getSetting('labs', {
    shopFloorBeta: true,
    advancedPlanning: false,
    batchBarcodeScan: false,
  });
  res.json(labs);
});

router.patch('/labs', requireOperatorForMutations, async (req, res) => {
  const data = z
    .object({
      shopFloorBeta: z.boolean().optional(),
      advancedPlanning: z.boolean().optional(),
      batchBarcodeScan: z.boolean().optional(),
    })
    .parse(req.body);
  const current = await getSetting('labs', {
    shopFloorBeta: true,
    advancedPlanning: false,
    batchBarcodeScan: false,
  });
  const merged = { ...current, ...data };
  await setSetting('labs', merged);
  res.json(merged);
});

router.get('/subscription', async (_req, res) => {
  const subscription = await getSetting('subscription', {
    plan: 'Professional',
    seats: 5,
    status: 'active',
    renewsAt: null as string | null,
  });
  res.json(subscription);
});

router.delete('/demo-data', requireOperatorForMutations, async (_req, res) => {
  await prisma.$transaction([
    prisma.salesOrderRow.deleteMany(),
    prisma.salesOrder.deleteMany(),
    prisma.purchaseOrderRow.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.manufacturingOrder.deleteMany(),
    prisma.inventoryMovement.deleteMany(),
    prisma.inventoryLevel.deleteMany(),
    prisma.quoteRow.deleteMany(),
    prisma.quote.deleteMany(),
  ]);
  res.json({ cleared: true });
});

export default router;
