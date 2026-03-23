import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const RETURN_REASONS = ['defective', 'wrong_item', 'not_needed', 'damaged', 'other'];

async function nextReturnNumber(): Promise<string> {
  const count = await prisma.salesReturn.count();
  return `SR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

const returnSchema = z.object({
  number: z.string().optional(),
  orderId: z.string().uuid().nullish(),
  customerId: z.string().uuid().nullish(),
  status: z.string().default('draft'),
  notes: z.string().nullish(),
});

const rowSchema = z.object({
  variantId: z.string().uuid().nullish(),
  soRowId: z.string().uuid().nullish(),
  description: z.string().nullish(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nullish(),
  returnReason: z.string().nullish(),
  locationId: z.string().uuid().nullish(),
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.salesReturn.findMany({ where, include: { rows: true }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.salesReturn.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = returnSchema.parse(req.body);
  const number = data.number || await nextReturnNumber();
  const item = await prisma.salesReturn.create({
    data: { number, orderId: data.orderId ?? undefined, customerId: data.customerId ?? undefined, status: data.status, notes: data.notes ?? undefined },
    include: { rows: true },
  });
  res.status(201).json(item);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.salesReturn.findUnique({ where: { id: req.params.id }, include: { rows: true } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = returnSchema.partial().parse(req.body);
  const item = await prisma.salesReturn.update({ where: { id: req.params.id }, data, include: { rows: true } });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.salesReturn.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Rows
router.post('/:id/rows', async (req, res) => {
  const data = rowSchema.parse(req.body);
  const row = await prisma.salesReturnRow.create({
    data: { returnId: req.params.id, ...data },
  });
  res.status(201).json(row);
});

router.get('/:id/rows', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { returnId: req.params.id };
  const [items, total] = await Promise.all([
    prisma.salesReturnRow.findMany({ where, skip, take }),
    prisma.salesReturnRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.patch('/rows/:id', async (req, res) => {
  const data = rowSchema.partial().parse(req.body);
  const row = await prisma.salesReturnRow.update({ where: { id: req.params.id }, data });
  res.json(row);
});

router.delete('/rows/:id', async (req, res) => {
  await prisma.salesReturnRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Complete — add stock back
router.post('/:id/complete', async (req, res) => {
  const ret = await prisma.salesReturn.findUnique({ where: { id: req.params.id }, include: { rows: true } });
  if (!ret) return res.status(404).json({ error: 'Not found' });
  if (ret.status === 'completed') return res.status(422).json({ error: 'Already completed' });
  if (ret.status === 'cancelled') return res.status(422).json({ error: 'Cannot complete cancelled return' });

  await prisma.$transaction(async (tx: any) => {
    for (const row of ret.rows) {
      if (row.variantId && row.locationId) {
        await adjustStock(tx, row.variantId, row.locationId, Number(row.qty), 'sales_return', {
          referenceType: 'sales_return', referenceId: ret.id, note: `Return ${ret.number}`,
        });
      }
    }
    await tx.salesReturn.update({ where: { id: ret.id }, data: { status: 'completed' } });
  });

  const updated = await prisma.salesReturn.findUnique({ where: { id: ret.id }, include: { rows: true } });
  res.json(updated);
});

// Return reasons
router.get('/return-reasons', (_req, res) => {
  res.json(RETURN_REASONS);
});

// Unassigned batch transactions for a return row
router.get('/:id/unassigned-batch-transactions', async (req, res) => {
  const ret = await prisma.salesReturn.findUnique({
    where: { id: req.params.id },
    include: { rows: true },
  });
  if (!ret) return res.status(404).json({ error: 'Not found' });
  // Rows without a linked batch
  const unassigned = ret.rows.filter((r: any) => !r.soRowId);
  res.json(unassigned);
});

export default router;
