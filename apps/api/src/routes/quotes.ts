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

const quoteSchema = z.object({
  number: z.string().optional(),
  customerId: z.string().uuid().nullish(),
  status: z.string().default('draft'),
  currency: z.string().default('USD'),
  validUntil: z.string().nullish(),
  notes: z.string().nullish(),
  rows: z.array(z.object({
    variantId: z.string().uuid().nullish(),
    description: z.string().nullish(),
    qty: z.coerce.number().default(1),
    unitPrice: z.coerce.number().nullish(),
    taxRate: z.coerce.number().nullish(),
  })).default([]),
});

const rowSchema = z.object({
  variantId: z.string().uuid().nullish(),
  description: z.string().nullish(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nullish(),
  taxRate: z.coerce.number().nullish(),
});

// GET / — paginated, filterable by status
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.quote.findMany({ where, include: { rows: true }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.quote.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST / — create with auto-generated number
router.post('/', async (req, res) => {
  const data = quoteSchema.parse(req.body);
  const number = data.number || await nextQuoteNumber();
  const item = await prisma.quote.create({
    data: {
      number,
      customerId: data.customerId ?? undefined,
      status: data.status,
      currency: data.currency,
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
    include: { rows: true },
  });
  res.status(201).json(item);
});

// GET /:id — include rows
router.get('/:id', async (req, res) => {
  const item = await prisma.quote.findUnique({ where: { id: req.params.id }, include: { rows: true } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// PUT /:id — update
router.put('/:id', async (req, res) => {
  const data = quoteSchema.partial().parse(req.body);
  const updateData: any = {};
  if (data.customerId !== undefined) updateData.customerId = data.customerId;
  if (data.status) updateData.status = data.status;
  if (data.currency) updateData.currency = data.currency;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.validUntil !== undefined) updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
  const item = await prisma.quote.update({ where: { id: req.params.id }, data: updateData, include: { rows: true } });
  res.json(item);
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  await prisma.quote.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /:id/rows — add a row
router.post('/:id/rows', async (req, res) => {
  const data = rowSchema.parse(req.body);
  const row = await prisma.quoteRow.create({
    data: { quoteId: req.params.id, ...data },
  });
  res.status(201).json(row);
});

// PATCH /rows/:id — update a row
router.patch('/rows/:id', async (req, res) => {
  const data = rowSchema.partial().parse(req.body);
  const row = await prisma.quoteRow.update({ where: { id: req.params.id }, data });
  res.json(row);
});

// DELETE /rows/:id — delete a row
router.delete('/rows/:id', async (req, res) => {
  await prisma.quoteRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /:id/convert-to-so — create a SalesOrder from the quote
router.post('/:id/convert-to-so', async (req, res) => {
  const quote = await prisma.quote.findUnique({ where: { id: req.params.id }, include: { rows: true } });
  if (!quote) return res.status(404).json({ error: 'Not found' });
  if (quote.status === 'accepted') return res.status(422).json({ error: 'Quote already accepted' });
  if (quote.status === 'rejected') return res.status(422).json({ error: 'Cannot convert rejected quote' });

  const soCount = await prisma.salesOrder.count();
  const soNumber = `SO-${new Date().getFullYear()}-${String(soCount + 1).padStart(4, '0')}`;

  const so = await prisma.$transaction(async (tx: any) => {
    const order = await tx.salesOrder.create({
      data: {
        number: soNumber,
        customerId: quote.customerId ?? undefined,
        currency: quote.currency,
        notes: quote.notes ?? undefined,
        rows: {
          create: quote.rows.map((r: any) => ({
            variantId: r.variantId ?? undefined,
            description: r.description ?? undefined,
            qtyOrdered: Number(r.qty),
            unitPrice: r.unitPrice != null ? Number(r.unitPrice) : undefined,
            taxRate: r.taxRate != null ? Number(r.taxRate) : undefined,
          })),
        },
      },
      include: { rows: true },
    });
    await tx.quote.update({ where: { id: quote.id }, data: { status: 'accepted' } });
    return order;
  });

  res.status(201).json(so);
});

export default router;
