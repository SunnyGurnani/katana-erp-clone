import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

async function nextQuoteNumber(): Promise<string> {
  const count = await prisma.quote.count();
  return `QT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

const include = {
  rows: true,
};

function normalizeQuote(q: any) {
  return {
    ...q,
    totalPrice: q.rows?.reduce((s: number, r: any) => s + Number(r.qty) * Number(r.unitPrice || 0), 0) ?? 0,
  };
}

// List quotes (paginated, filterable by status)
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.quote.findMany({ where, include, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.quote.count({ where }),
  ]);
  res.json(paginated(items.map(normalizeQuote), total, page, pageSize));
});

// Create quote
router.post('/', async (req, res) => {
  const data = z.object({
    number: z.string().optional(),
    customerId: z.string().uuid().nullish(),
    currency: z.string().default('USD'),
    status: z.string().default('draft'),
    validUntil: z.string().nullish(),
    notes: z.string().nullish(),
    rows: z.array(z.object({
      variantId: z.string().uuid().nullish(),
      description: z.string().nullish(),
      qty: z.coerce.number().default(1),
      unitPrice: z.coerce.number().nullish(),
      taxRate: z.coerce.number().nullish(),
    })).default([]),
  }).parse(req.body);
  const number = data.number || await nextQuoteNumber();
  const quote = await prisma.quote.create({
    data: {
      number,
      customerId: data.customerId ?? undefined,
      currency: data.currency,
      status: data.status,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      notes: data.notes ?? undefined,
      rows: {
        create: data.rows.map(r => ({
          variantId: r.variantId ?? undefined,
          description: r.description ?? undefined,
          qty: r.qty,
          unitPrice: r.unitPrice ?? undefined,
          taxRate: r.taxRate ?? undefined,
        })),
      },
    },
    include,
  });
  res.status(201).json(normalizeQuote(quote));
});

// Get quote by id
router.get('/:id', async (req, res) => {
  const quote = await prisma.quote.findUnique({ where: { id: req.params.id }, include });
  if (!quote) return res.status(404).json({ error: 'Not found' });
  res.json(normalizeQuote(quote));
});

// Update quote
router.put('/:id', async (req, res) => {
  const data = z.object({
    customerId: z.string().uuid().nullish(),
    status: z.string().nullish(),
    currency: z.string().nullish(),
    validUntil: z.string().nullish(),
    notes: z.string().nullish(),
  }).partial().parse(req.body);
  const updateData: any = {};
  if (data.customerId !== undefined) updateData.customerId = data.customerId;
  if (data.status) updateData.status = data.status;
  if (data.currency) updateData.currency = data.currency;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.validUntil !== undefined) updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
  const quote = await prisma.quote.update({ where: { id: req.params.id }, data: updateData, include });
  res.json(normalizeQuote(quote));
});

// Delete quote
router.delete('/:id', async (req, res) => {
  await prisma.quote.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Add row to quote
router.post('/:id/rows', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(),
    description: z.string().nullish(),
    qty: z.coerce.number().default(1),
    unitPrice: z.coerce.number().nullish(),
    taxRate: z.coerce.number().nullish(),
  }).parse(req.body);
  const row = await prisma.quoteRow.create({
    data: {
      quoteId: req.params.id,
      variantId: data.variantId ?? undefined,
      description: data.description ?? undefined,
      qty: data.qty,
      unitPrice: data.unitPrice ?? undefined,
      taxRate: data.taxRate ?? undefined,
    },
  });
  res.status(201).json(row);
});

// Update quote row
router.patch('/rows/:id', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(),
    description: z.string().nullish(),
    qty: z.coerce.number().optional(),
    unitPrice: z.coerce.number().nullish(),
    taxRate: z.coerce.number().nullish(),
  }).partial().parse(req.body);
  const row = await prisma.quoteRow.update({ where: { id: req.params.id }, data });
  res.json(row);
});

// Delete quote row
router.delete('/rows/:id', async (req, res) => {
  await prisma.quoteRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Convert quote to sales order
router.post('/:id/convert-to-so', async (req, res) => {
  const quote = await prisma.quote.findUnique({ where: { id: req.params.id }, include });
  if (!quote) return res.status(404).json({ error: 'Not found' });
  if (quote.status === 'accepted') return res.status(422).json({ error: 'Quote already converted' });
  if (quote.status === 'rejected' || quote.status === 'expired') {
    return res.status(422).json({ error: `Cannot convert ${quote.status} quote` });
  }

  // Generate SO number
  const soCount = await prisma.salesOrder.count();
  const soNumber = `SO-${new Date().getFullYear()}-${String(soCount + 1).padStart(4, '0')}`;

  const so = await prisma.$transaction(async (tx) => {
    const created = await tx.salesOrder.create({
      data: {
        number: soNumber,
        customerId: quote.customerId ?? undefined,
        currency: quote.currency,
        notes: quote.notes ?? undefined,
        rows: {
          create: (quote.rows as any[]).map((r: any) => ({
            variantId: r.variantId ?? undefined,
            description: r.description ?? undefined,
            qtyOrdered: Number(r.qty),
            unitPrice: r.unitPrice != null ? Number(r.unitPrice) : undefined,
            taxRate: r.taxRate != null ? Number(r.taxRate) : undefined,
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        rows: { include: { fulfillments: true } },
      },
    });
    await tx.quote.update({ where: { id: quote.id }, data: { status: 'accepted' } });
    return created;
  });

  res.status(201).json(so);
});

export default router;
