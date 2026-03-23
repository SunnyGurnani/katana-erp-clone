import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

async function nextPoNumber(): Promise<string> {
  const count = await prisma.purchaseOrder.count();
  return `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

// PurchaseOrderRow has no Prisma relations to variant/material — just IDs
const include = {
  supplier: { select: { id: true, name: true } },
  rows: true,
  costRows: true,
};

function normalizePo(po: any) {
  return {
    ...po,
    poNumber: po.number,
    totalCost: po.rows?.reduce((s: number, r: any) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0) ?? 0,
    expectedAt: po.expectedDate,
    rows: po.rows?.map((r: any) => ({ ...r, qty: r.qtyOrdered, unitCost: r.unitPrice })),
  };
}

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({ where, include, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.purchaseOrder.count({ where }),
  ]);
  res.json(paginated(items.map(normalizePo), total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = z.object({
    number: z.string().optional(),
    supplierId: z.string().uuid().nullish(),
    currency: z.string().default('USD'),
    expectedAt: z.string().nullish(),
    notes: z.string().nullish(),
    locationId: z.string().uuid().nullish(),
    rows: z.array(z.object({
      variantId: z.string().uuid().nullish(),
      materialId: z.string().uuid().nullish(),
      description: z.string().nullish(),
      qtyOrdered: z.coerce.number().optional().default(1),
      qty: z.coerce.number().optional(),
      unitPrice: z.coerce.number().nullish(),
      unitCost: z.coerce.number().nullish(),
    })).default([]),
  }).parse(req.body);
  const number = data.number || await nextPoNumber();
  const rows = data.rows.map(r => ({
    variantId: r.variantId ?? undefined,
    materialId: r.materialId ?? undefined,
    description: r.description ?? undefined,
    qtyOrdered: r.qty ?? r.qtyOrdered ?? 1,
    unitPrice: r.unitCost ?? r.unitPrice ?? undefined,
  }));
  const po = await prisma.purchaseOrder.create({
    data: {
      number, supplierId: data.supplierId ?? undefined, currency: data.currency,
      expectedDate: data.expectedAt ? new Date(data.expectedAt) : undefined,
      notes: data.notes ?? undefined, locationId: data.locationId ?? undefined,
      rows: { create: rows },
    },
    include,
  });
  res.status(201).json(normalizePo(po));
});

router.get('/:id', async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include });
  if (!po) return res.status(404).json({ error: 'Not found' });
  res.json(normalizePo(po));
});

router.put('/:id', async (req, res) => {
  const data = z.object({
    supplierId: z.string().uuid().nullish(), status: z.string().nullish(),
    currency: z.string().nullish(), expectedAt: z.string().nullish(),
    notes: z.string().nullish(), locationId: z.string().uuid().nullish(),
  }).partial().parse(req.body);
  const poData: any = {};
  if (data.supplierId !== undefined) poData.supplierId = data.supplierId;
  if (data.status) poData.status = data.status;
  if (data.currency) poData.currency = data.currency;
  if (data.notes !== undefined) poData.notes = data.notes;
  if (data.locationId !== undefined) poData.locationId = data.locationId;
  if (data.expectedAt !== undefined) poData.expectedDate = data.expectedAt ? new Date(data.expectedAt) : null;
  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: poData, include });
  res.json(normalizePo(po));
});

router.post('/:id/rows', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(), materialId: z.string().uuid().nullish(),
    description: z.string().nullish(), qty: z.coerce.number().default(1), unitCost: z.coerce.number().nullish(),
  }).parse(req.body);
  const row = await prisma.purchaseOrderRow.create({
    data: { orderId: req.params.id, variantId: data.variantId ?? undefined, materialId: data.materialId ?? undefined, description: data.description ?? undefined, qtyOrdered: data.qty, unitPrice: data.unitCost ?? undefined },
  });
  res.status(201).json({ ...row, qty: row.qtyOrdered, unitCost: row.unitPrice });
});

router.post('/:id/receive', async (req, res) => {
  const body = z.object({
    locationId: z.string().uuid().optional(),
    rows: z.array(z.object({ rowId: z.string().uuid(), receivedQty: z.coerce.number().positive() })).optional(),
  }).parse(req.body);
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include });
  if (!po) return res.status(404).json({ error: 'Not found' });
  if (po.status === 'cancelled') return res.status(422).json({ error: 'Cannot receive cancelled PO' });
  const destLocationId = body.locationId ?? po.locationId;
  if (!destLocationId) return res.status(422).json({ error: 'Provide a locationId' });

  const rowsToReceive = body.rows ?? (po.rows as any[]).map((r: any) => ({ rowId: r.id, receivedQty: Number(r.qtyOrdered) - Number(r.qtyReceived || 0) }));

  await prisma.$transaction(async (tx: any) => {
    for (const recv of rowsToReceive) {
      if (recv.receivedQty <= 0) continue;
      const row = (po.rows as any[]).find((r: any) => r.id === recv.rowId);
      if (!row) continue;
      if (row.variantId) {
        await adjustStock(tx, row.variantId, destLocationId, recv.receivedQty, 'po_receipt', { referenceType: 'purchase_order', referenceId: po.id, note: `PO ${po.number}` });
      }
      await tx.purchaseOrderRow.update({ where: { id: row.id }, data: { qtyReceived: { increment: recv.receivedQty } } });
    }
  });

  const allRows = await prisma.purchaseOrderRow.findMany({ where: { orderId: po.id } });
  const allFulfilled = allRows.every((r: any) => Number(r.qtyReceived) >= Number(r.qtyOrdered));
  const anyFulfilled = allRows.some((r: any) => Number(r.qtyReceived) > 0);
  const newStatus = allFulfilled ? 'received' : anyFulfilled ? 'partial' : po.status;
  const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: newStatus }, include });
  res.json(normalizePo(updated));
});

export default router;
