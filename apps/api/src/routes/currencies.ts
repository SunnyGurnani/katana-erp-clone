import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';
import fetch from 'node-fetch';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const currencySchema = z.object({
  code: z.string().length(3),
  name: z.string(),
  symbol: z.string(),
  isBase: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const rateSchema = z.object({
  fromCode: z.string().length(3),
  toCode: z.string().length(3),
  rate: z.coerce.number().positive(),
  source: z.string().default('manual'),
  effectiveAt: z.coerce.date().optional(),
});

// ── STATIC ROUTES FIRST (before /:id) ─────────────────────────────────────────

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.currency.findMany({ include: { rates: { orderBy: { effectiveAt: 'desc' }, take: 1 } }, skip, take, orderBy: { code: 'asc' } }),
    prisma.currency.count(),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = currencySchema.parse(req.body);
  if (data.isBase) await prisma.currency.updateMany({ where: { isBase: true }, data: { isBase: false } });
  const item = await prisma.currency.create({ data: { ...data, code: data.code.toUpperCase() } });
  res.status(201).json(item);
});

// GET /currencies/convert?from=USD&to=EUR&amount=100
router.get('/convert', async (req, res) => {
  const { from, to, amount } = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    amount: z.coerce.number().positive(),
  }).parse(req.query);

  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  if (fromCode === toCode) return res.json({ from: fromCode, to: toCode, amount, converted: amount, rate: 1 });

  const rateRecord = await prisma.exchangeRate.findFirst({ where: { fromCode, toCode }, orderBy: { effectiveAt: 'desc' } });
  const inverseRecord = !rateRecord
    ? await prisma.exchangeRate.findFirst({ where: { fromCode: toCode, toCode: fromCode }, orderBy: { effectiveAt: 'desc' } })
    : null;

  const rate = rateRecord ? Number(rateRecord.rate) : inverseRecord ? (1 / Number(inverseRecord.rate)) : null;
  if (rate === null) return res.status(404).json({ error: `No exchange rate found for ${fromCode}/${toCode}` });

  const converted = parseFloat((amount * rate).toFixed(6));
  res.json({ from: fromCode, to: toCode, amount, converted, rate, effectiveAt: rateRecord?.effectiveAt || inverseRecord?.effectiveAt });
});

// GET /currencies/exchange-rates/list
router.get('/exchange-rates/list', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { fromCode, toCode } = req.query as Record<string, string>;
  const where: any = {};
  if (fromCode) where.fromCode = fromCode.toUpperCase();
  if (toCode) where.toCode = toCode.toUpperCase();
  const [items, total] = await Promise.all([
    prisma.exchangeRate.findMany({ where, skip, take, orderBy: { effectiveAt: 'desc' } }),
    prisma.exchangeRate.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /currencies/exchange-rates
router.post('/exchange-rates', async (req, res) => {
  const data = rateSchema.parse(req.body);
  const fromCur = await prisma.currency.findFirst({ where: { code: data.fromCode.toUpperCase() } });
  if (!fromCur) return res.status(404).json({ error: `Currency ${data.fromCode} not found. Create it first.` });
  const item = await prisma.exchangeRate.create({
    data: { fromCode: data.fromCode.toUpperCase(), toCode: data.toCode.toUpperCase(), rate: data.rate, source: data.source, effectiveAt: data.effectiveAt ?? new Date() },
  });
  res.status(201).json(item);
});

// POST /currencies/exchange-rates/fetch
router.post('/exchange-rates/fetch', async (req, res) => {
  const { base } = z.object({ base: z.string().length(3).default('USD') }).parse(req.body);
  const baseCode = base.toUpperCase();

  const apiRes = await fetch(`https://open.er-api.com/v6/latest/${baseCode}`);
  if (!apiRes.ok) return res.status(502).json({ error: 'Failed to fetch from exchange rate API' });
  const json = await apiRes.json() as any;
  if (json.result !== 'success') return res.status(502).json({ error: json['error-type'] || 'API error' });

  await prisma.currency.upsert({ where: { code: baseCode }, create: { code: baseCode, name: baseCode, symbol: baseCode, isBase: true }, update: {} });

  const now = new Date();
  let count = 0;
  for (const [code, rate] of Object.entries(json.rates as Record<string, number>)) {
    try {
      await prisma.exchangeRate.create({ data: { fromCode: baseCode, toCode: code, rate, source: 'open.er-api.com', effectiveAt: now } });
      count++;
    } catch { /* skip duplicates */ }
  }
  res.json({ fetched: count, base: baseCode, timestamp: json.time_last_update_utc });
});

// ── DYNAMIC ROUTES (after statics) ────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  const item = await prisma.currency.findUnique({ where: { id: req.params.id }, include: { rates: { orderBy: { effectiveAt: 'desc' }, take: 50 } } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = currencySchema.partial().parse(req.body);
  if (data.isBase) await prisma.currency.updateMany({ where: { isBase: true }, data: { isBase: false } });
  const item = await prisma.currency.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.currency.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
