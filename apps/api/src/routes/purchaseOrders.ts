import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const include = { rows: true, costRows: true };

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({ where, include, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.purchaseOrder.count({ where })
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = z.object({
    number: z.string(), supplierId: z.string().uuid().nullish(), currency: z.string().default('USD'),
    orderDate: z.string().nullish(), expectedDate: z.string().nullish(), notes: z.string().nullish(), locationId: z.string().uuid().nullish(),
    rows: z.array(z.object({ materialId: z.string().uuid().nullish(), variantId: z.string().uuid().nullish(), description: z.string().nullish(), qtyOrdered: z.number(), unitPrice: z.number().nullish(), taxRate: z.number().nullish() })).default([]),
    costRows: z.array(z.object({ description: z.string(), amount: z.number() })).default([]),
  }).parse(req.body);
  const po = await prisma.purchaseOrder.create({
    data: {
      number: data.number, supplierId: data.supplierId ?? undefined, currency: data.currency,
      orderDate: data.orderDate ? new Date(data.orderDate) : undefined,
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
      notes: data.notes ?? undefined, locationId: data.locationId ?? undefined,
      rows: { create: data.rows },
      costRows: { create: data.costRows },
    },
    include,
  });
  res.status(201).json(po);
});

router.get('/:id', async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include });
  if (!po) return res.status(404).json({ error: 'Not found' });
  res.json(po);
});

router.patch('/:id', async (req, res) => {
  const data = z.object({ supplierId: z.string().uuid().nullish(), status: z.string().nullish(), currency: z.string().nullish(), orderDate: z.string().nullish(), expectedDate: z.string().nullish(), notes: z.string().nullish(), locationId: z.string().uuid().nullish() }).partial().parse(req.body);
  const poData: any = Object.fromEntries(Object.entries(data).filter(([,v]) => v != null));
  if (data.orderDate !== undefined) poData.orderDate = data.orderDate ? new Date(data.orderDate) : undefined;
  if (data.expectedDate !== undefined) poData.expectedDate = data.expectedDate ? new Date(data.expectedDate) : undefined;
  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: poData, include });
  res.json(po);
});

router.post('/:id/receive', async (req, res) => {
  const { rows } = z.object({ rows: z.array(z.object({ rowId: z.string().uuid(), qty: z.number().positive() })) }).parse(req.body);
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include });
  if (!po) return res.status(404).json({ error: 'Not found' });
  if (po.status === 'cancelled') return res.status(422).json({ error: 'Cannot receive cancelled PO' });
  if (!po.locationId) return res.status(422).json({ error: 'PO must have a location' });

  await prisma.$transaction(async (tx) => {
    for (const recv of rows) {
      const row = po.rows.find(r => r.id === recv.rowId);
      if (!row) throw Object.assign(new Error(`Row ${recv.rowId} not found`), { statusCode: 404 });
      const remaining = Number(row.qtyOrdered) - Number(row.qtyReceived);
      if (recv.qty > remaining) throw Object.assign(new Error(`Qty exceeds remaining ${remaining}`), { statusCode: 422 });
      if (row.variantId) {
        await adjustStock(tx, row.variantId, po.locationId!, recv.qty, 'po_receipt', { referenceType: 'purchase_order', referenceId: po.id, note: `PO ${po.number}` });
      }
      await tx.purchaseOrderRow.update({ where: { id: row.id }, data: { qtyReceived: { increment: recv.qty } } });
    }
  });

  const updated = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include });
  const allReceived = updated!.rows.every(r => Number(r.qtyReceived) >= Number(r.qtyOrdered));
  const anyReceived = updated!.rows.some(r => Number(r.qtyReceived) > 0);
  const status = allReceived ? 'received' : anyReceived ? 'partial' : po.status;
  const final = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status }, include });
  res.json(final);
});

router.delete('/:id', async (req, res) => {
  await prisma.purchaseOrder.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
