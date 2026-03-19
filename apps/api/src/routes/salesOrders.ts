import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const include = { rows: true, fulfillments: true };

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.salesOrder.findMany({ where, include, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.salesOrder.count({ where })
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = z.object({
    number: z.string(), customerId: z.string().uuid().nullish(), currency: z.string().default('USD'),
    orderDate: z.string().nullish(), requiredDate: z.string().nullish(), notes: z.string().nullish(), locationId: z.string().uuid().nullish(),
    rows: z.array(z.object({ variantId: z.string().uuid().nullish(), description: z.string().nullish(), qtyOrdered: z.number(), unitPrice: z.number().nullish(), taxRate: z.number().nullish() })).default([]),
  }).parse(req.body);
  const so = await prisma.salesOrder.create({
    data: {
      number: data.number, customerId: data.customerId ?? undefined, currency: data.currency,
      orderDate: data.orderDate ? new Date(data.orderDate) : undefined,
      requiredDate: data.requiredDate ? new Date(data.requiredDate) : undefined,
      notes: data.notes ?? undefined, locationId: data.locationId ?? undefined,
      rows: { create: data.rows },
    },
    include,
  });
  res.status(201).json(so);
});

router.get('/:id', async (req, res) => {
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include });
  if (!so) return res.status(404).json({ error: 'Not found' });
  res.json(so);
});

router.patch('/:id', async (req, res) => {
  const data = z.object({ customerId: z.string().uuid().nullish(), status: z.string().nullish(), currency: z.string().nullish(), orderDate: z.string().nullish(), requiredDate: z.string().nullish(), notes: z.string().nullish(), locationId: z.string().uuid().nullish() }).partial().parse(req.body);
  const soData: any = Object.fromEntries(Object.entries(data).filter(([,v]) => v != null));
  if (data.orderDate !== undefined) soData.orderDate = data.orderDate ? new Date(data.orderDate) : undefined;
  if (data.requiredDate !== undefined) soData.requiredDate = data.requiredDate ? new Date(data.requiredDate) : undefined;
  const so = await prisma.salesOrder.update({ where: { id: req.params.id }, data: soData, include });
  res.json(so);
});

router.post('/:id/fulfill', async (req, res) => {
  const { rows } = z.object({ rows: z.array(z.object({ rowId: z.string().uuid(), qty: z.number().positive(), locationId: z.string().uuid().nullish(), isReturn: z.boolean().default(false), notes: z.string().nullish() })) }).parse(req.body);
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include });
  if (!so) return res.status(404).json({ error: 'Not found' });
  if (so.status === 'cancelled') return res.status(422).json({ error: 'Cannot fulfill cancelled SO' });

  await prisma.$transaction(async (tx) => {
    for (const f of rows) {
      const row = so.rows.find(r => r.id === f.rowId);
      if (!row) throw Object.assign(new Error(`Row ${f.rowId} not found`), { statusCode: 404 });
      const locId = f.locationId ?? so.locationId;
      if (!locId) throw Object.assign(new Error('Location required for fulfillment'), { statusCode: 422 });
      if (row.variantId) {
        const qty = f.isReturn ? f.qty : -f.qty;
        const type = f.isReturn ? 'so_return' : 'so_shipment';
        await adjustStock(tx, row.variantId, locId, qty, type, { referenceType: 'sales_order', referenceId: so.id, note: `SO ${so.number}` });
      }
      const newFulfilled = f.isReturn ? Math.max(0, Number(row.qtyFulfilled) - f.qty) : Number(row.qtyFulfilled) + f.qty;
      await tx.salesOrderRow.update({ where: { id: row.id }, data: { qtyFulfilled: newFulfilled } });
      await tx.salesOrderFulfillment.create({ data: { orderId: so.id, rowId: row.id, qty: f.qty, locationId: locId, isReturn: f.isReturn, notes: f.notes ?? undefined } });
    }
  });

  const updated = await prisma.salesOrder.findUnique({ where: { id: so.id }, include });
  const allFulfilled = updated!.rows.every(r => Number(r.qtyFulfilled) >= Number(r.qtyOrdered));
  const anyFulfilled = updated!.rows.some(r => Number(r.qtyFulfilled) > 0);
  const status = allFulfilled ? 'fulfilled' : anyFulfilled ? 'partial' : so.status;
  const final = await prisma.salesOrder.update({ where: { id: so.id }, data: { status }, include });
  res.json(final);
});

router.delete('/:id', async (req, res) => {
  await prisma.salesOrder.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
