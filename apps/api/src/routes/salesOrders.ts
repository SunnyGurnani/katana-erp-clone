import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';
import soAddressesRouter from './soAddresses';

const router = Router();
router.use(authenticate);

async function nextSoNumber(): Promise<string> {
  const count = await prisma.salesOrder.count();
  return `SO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

// SalesOrderRow has no Prisma relations other than order/fulfillments
const include = {
  customer: { select: { id: true, name: true } },
  rows: { include: { fulfillments: true } },
};

function normalizeSo(so: any) {
  return {
    ...so,
    soNumber: so.number,
    dueAt: so.requiredDate,
    totalPrice: so.rows?.reduce((s: number, r: any) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0) ?? 0,
    rows: so.rows?.map((r: any) => ({ ...r, qty: r.qtyOrdered, salePrice: r.unitPrice, fulfilledQty: r.qtyFulfilled })),
  };
}

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.salesOrder.findMany({ where, include, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.salesOrder.count({ where }),
  ]);
  res.json(paginated(items.map(normalizeSo), total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = z.object({
    number: z.string().optional(),
    customerId: z.string().uuid().nullish(),
    currency: z.string().default('USD'),
    dueAt: z.string().nullish(),
    notes: z.string().nullish(),
    locationId: z.string().uuid().nullish(),
    rows: z.array(z.object({
      variantId: z.string().uuid().nullish(),
      description: z.string().nullish(),
      qty: z.coerce.number().optional().default(1),
      qtyOrdered: z.coerce.number().optional(),
      salePrice: z.coerce.number().nullish(),
      unitPrice: z.coerce.number().nullish(),
    })).default([]),
  }).parse(req.body);
  const number = data.number || await nextSoNumber();
  const so = await prisma.salesOrder.create({
    data: {
      number, customerId: data.customerId ?? undefined, currency: data.currency,
      requiredDate: data.dueAt ? new Date(data.dueAt) : undefined,
      notes: data.notes ?? undefined, locationId: data.locationId ?? undefined,
      rows: {
        create: data.rows.map(r => ({
          variantId: r.variantId ?? undefined,
          description: r.description ?? undefined,
          qtyOrdered: r.qtyOrdered ?? r.qty,
          unitPrice: r.unitPrice ?? r.salePrice ?? undefined,
        })),
      },
    },
    include,
  });
  res.status(201).json(normalizeSo(so));
});

router.get('/:id', async (req, res) => {
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include });
  if (!so) return res.status(404).json({ error: 'Not found' });
  res.json(normalizeSo(so));
});

router.put('/:id', async (req, res) => {
  const data = z.object({
    customerId: z.string().uuid().nullish(), status: z.string().nullish(),
    currency: z.string().nullish(), dueAt: z.string().nullish(),
    notes: z.string().nullish(), locationId: z.string().uuid().nullish(),
  }).partial().parse(req.body);
  const soData: any = {};
  if (data.customerId !== undefined) soData.customerId = data.customerId;
  if (data.status) soData.status = data.status;
  if (data.currency) soData.currency = data.currency;
  if (data.notes !== undefined) soData.notes = data.notes;
  if (data.locationId !== undefined) soData.locationId = data.locationId;
  if (data.dueAt !== undefined) soData.requiredDate = data.dueAt ? new Date(data.dueAt) : null;
  const so = await prisma.salesOrder.update({ where: { id: req.params.id }, data: soData, include });
  res.json(normalizeSo(so));
});

router.post('/:id/rows', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(), description: z.string().nullish(),
    qty: z.coerce.number().default(1), salePrice: z.coerce.number().nullish(),
  }).parse(req.body);
  const row = await prisma.salesOrderRow.create({
    data: { orderId: req.params.id, variantId: data.variantId ?? undefined, description: data.description ?? undefined, qtyOrdered: data.qty, unitPrice: data.salePrice ?? undefined },
  });
  res.status(201).json({ ...row, qty: row.qtyOrdered, salePrice: row.unitPrice });
});

router.post('/:id/fulfill', async (req, res) => {
  const body = z.object({
    locationId: z.string().uuid().optional(),
    rows: z.array(z.object({ rowId: z.string().uuid(), qty: z.coerce.number().positive(), isReturn: z.boolean().default(false) })).optional(),
  }).parse(req.body);
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include });
  if (!so) return res.status(404).json({ error: 'Not found' });
  if (so.status === 'cancelled') return res.status(422).json({ error: 'Cannot fulfill cancelled SO' });
  const srcLocationId = body.locationId ?? so.locationId;
  if (!srcLocationId) return res.status(422).json({ error: 'Provide a locationId' });

  const rowsToFulfill = body.rows ?? (so.rows as any[]).map((r: any) => ({
    rowId: r.id, qty: Number(r.qtyOrdered) - Number(r.qtyFulfilled || 0), isReturn: false,
  }));

  await prisma.$transaction(async (tx) => {
    for (const item of rowsToFulfill) {
      if (item.qty <= 0) continue;
      const row = (so.rows as any[]).find((r: any) => r.id === item.rowId);
      if (!row || !row.variantId) continue;
      await adjustStock(tx, row.variantId, srcLocationId, -item.qty, 'so_fulfillment', { referenceType: 'sales_order', referenceId: so.id, note: `SO ${so.number}` });
      await tx.salesOrderRow.update({ where: { id: row.id }, data: { qtyFulfilled: { increment: item.qty } } });
      // Create per-row fulfillment record
      await tx.salesOrderFulfillment.create({
        data: { orderId: so.id, rowId: row.id, qty: item.qty, locationId: srcLocationId, isReturn: item.isReturn },
      });
    }
  });

  const allRows = await prisma.salesOrderRow.findMany({ where: { orderId: so.id } });
  const allFulfilled = allRows.every(r => Number(r.qtyFulfilled) >= Number(r.qtyOrdered));
  const anyFulfilled = allRows.some(r => Number(r.qtyFulfilled) > 0);
  const newStatus = allFulfilled ? 'fulfilled' : anyFulfilled ? 'partial' : so.status;
  const updated = await prisma.salesOrder.update({ where: { id: so.id }, data: { status: newStatus }, include });
  res.json(normalizeSo(updated));
});

// SO Addresses sub-routes
router.use(soAddressesRouter);

export default router;
