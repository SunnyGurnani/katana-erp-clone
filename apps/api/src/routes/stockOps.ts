import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// Stock Adjustments
router.get('/adjustments', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([prisma.stockAdjustment.findMany({ skip, take, orderBy: { createdAt: 'desc' } }), prisma.stockAdjustment.count()]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/adjustments', async (req: AuthRequest, res) => {
  const data = z.object({ variantId: z.string().uuid(), locationId: z.string().uuid(), qtyDelta: z.number().refine(n => n !== 0), reason: z.string(), note: z.string().nullish() }).parse(req.body);
  await prisma.$transaction(async (tx) => {
    await adjustStock(tx, data.variantId, data.locationId, data.qtyDelta, 'adjustment', { referenceType: 'stock_adjustment', note: data.reason });
    await tx.stockAdjustment.create({ data: { variantId: data.variantId, locationId: data.locationId, qtyDelta: data.qtyDelta, reason: data.reason, note: data.note ?? undefined, createdById: req.userId } });
  });
  res.status(201).json({ message: 'Adjustment applied' });
});

// Stock Transfers
router.get('/transfers', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([prisma.stockTransfer.findMany({ skip, take, orderBy: { createdAt: 'desc' } }), prisma.stockTransfer.count()]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/transfers', async (req: AuthRequest, res) => {
  const data = z.object({ variantId: z.string().uuid(), fromLocationId: z.string().uuid(), toLocationId: z.string().uuid(), qty: z.number().positive(), note: z.string().nullish() }).parse(req.body);
  const transfer = await prisma.$transaction(async (tx) => {
    await adjustStock(tx, data.variantId, data.fromLocationId, -data.qty, 'transfer_out', { referenceType: 'stock_transfer', note: data.note ?? undefined });
    await adjustStock(tx, data.variantId, data.toLocationId, data.qty, 'transfer_in', { referenceType: 'stock_transfer', note: data.note ?? undefined });
    return tx.stockTransfer.create({ data: { variantId: data.variantId, fromLocationId: data.fromLocationId, toLocationId: data.toLocationId, qty: data.qty, note: data.note ?? undefined, createdById: req.userId } });
  });
  res.status(201).json(transfer);
});

// Stocktakes
router.get('/stocktakes', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([prisma.stocktake.findMany({ include: { rows: true }, skip, take, orderBy: { createdAt: 'desc' } }), prisma.stocktake.count()]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/stocktakes', async (req, res) => {
  const { locationId, notes } = z.object({ locationId: z.string().uuid(), notes: z.string().nullish() }).parse(req.body);
  const st = await prisma.stocktake.create({ data: { locationId, notes: notes ?? undefined }, include: { rows: true } });
  res.status(201).json(st);
});

router.get('/stocktakes/:id', async (req, res) => {
  const st = await prisma.stocktake.findUnique({ where: { id: req.params.id }, include: { rows: true } });
  if (!st) return res.status(404).json({ error: 'Not found' });
  res.json(st);
});

router.post('/stocktakes/:id/rows', async (req, res) => {
  const { variantId, countedQty } = z.object({ variantId: z.string().uuid(), countedQty: z.number().min(0) }).parse(req.body);
  const st = await prisma.stocktake.findUnique({ where: { id: req.params.id } });
  if (!st || st.status !== 'draft') return res.status(422).json({ error: 'Stocktake is not in draft' });
  const level = await prisma.inventoryLevel.findUnique({ where: { variantId_locationId: { variantId, locationId: st.locationId } } });
  const systemQty = level ? Number(level.onHand) : 0;
  const row = await prisma.stocktakeRow.create({ data: { stocktakeId: st.id, variantId, countedQty, systemQty, variance: countedQty - systemQty } });
  res.status(201).json(row);
});

router.post('/stocktakes/:id/commit', async (req, res) => {
  const st = await prisma.stocktake.findUnique({ where: { id: req.params.id }, include: { rows: true } });
  if (!st || st.status !== 'draft') return res.status(422).json({ error: 'Stocktake is not in draft' });
  await prisma.$transaction(async (tx) => {
    for (const row of st.rows) {
      if (Number(row.variance) !== 0) {
        await adjustStock(tx, row.variantId, st.locationId, Number(row.variance), 'stocktake_adjustment', { referenceType: 'stocktake', referenceId: st.id });
      }
    }
    await tx.stocktake.update({ where: { id: st.id }, data: { status: 'committed' } });
  });
  res.json({ message: 'Stocktake committed' });
});

export default router;
