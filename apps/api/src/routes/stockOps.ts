import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// ─── Stock Adjustments ───────────────────────────────────────────────────────
// StockAdjustment has no Prisma relations — only raw ID fields

router.get('/adjustments', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.stockAdjustment.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.stockAdjustment.count(),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/adjustments/:id', async (req, res) => {
  const item = await prisma.stockAdjustment.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/adjustments/:id', async (req, res) => {
  const data = z.object({ reason: z.string().optional(), note: z.string().nullish() }).parse(req.body);
  const item = await prisma.stockAdjustment.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/adjustments/:id', async (req, res) => {
  await prisma.stockAdjustment.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.post('/adjustments', async (req: AuthRequest, res) => {
  const body = req.body;
  // Accept both `qty` and `qtyDelta` from frontend
  const rawQty = body.qtyDelta ?? body.qty;
  const data = z.object({
    variantId: z.string().uuid(),
    locationId: z.string().uuid(),
    qtyDelta: z.number().refine(n => n !== 0, { message: 'qtyDelta must be non-zero' }),
    reason: z.string(),
    note: z.string().nullish(),
  }).parse({ ...body, qtyDelta: typeof rawQty === 'number' ? rawQty : Number(rawQty) });

  let created: any;
  await prisma.$transaction(async (tx: any) => {
    await adjustStock(tx, data.variantId, data.locationId, data.qtyDelta, 'adjustment', {
      referenceType: 'stock_adjustment', note: data.reason,
    });
    created = await tx.stockAdjustment.create({
      data: {
        variantId: data.variantId, locationId: data.locationId, qtyDelta: data.qtyDelta,
        reason: data.reason, note: data.note ?? undefined, createdById: req.userId,
      },
    });
  });
  res.status(201).json(created);
});

// ─── Stock Transfers ──────────────────────────────────────────────────────────
// StockTransfer has no Prisma relations — only raw ID fields

router.get('/transfers', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.stockTransfer.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.stockTransfer.count(),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/transfers/:id', async (req, res) => {
  const item = await prisma.stockTransfer.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// Bulk status update for stock transfers (must be before /:id routes)
router.patch('/transfers/bulk-status', async (req, res) => {
  const { ids, status } = z.object({
    ids: z.array(z.string().uuid()),
    status: z.string(),
  }).parse(req.body);
  const result = await prisma.stockTransfer.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });
  res.json({ updated: result.count });
});

router.patch('/transfers/:id', async (req, res) => {
  const data = z.object({ note: z.string().nullish(), status: z.string().optional() }).parse(req.body);
  const item = await prisma.stockTransfer.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/transfers/:id', async (req, res) => {
  await prisma.stockTransfer.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.patch('/transfers/:id/status', async (req, res) => {
  const { status } = z.object({ status: z.string() }).parse(req.body);
  const item = await prisma.stockTransfer.update({ where: { id: req.params.id }, data: { status } });
  res.json(item);
});

router.post('/transfers', async (req: AuthRequest, res) => {
  const data = z.object({
    variantId: z.string().uuid(), fromLocationId: z.string().uuid(),
    toLocationId: z.string().uuid(), qty: z.number().positive(), note: z.string().nullish(),
  }).parse(req.body);

  const transfer = await prisma.$transaction(async (tx: any) => {
    await adjustStock(tx, data.variantId, data.fromLocationId, -data.qty, 'transfer_out', { referenceType: 'stock_transfer', note: data.note ?? undefined });
    await adjustStock(tx, data.variantId, data.toLocationId, data.qty, 'transfer_in', { referenceType: 'stock_transfer', note: data.note ?? undefined });
    return tx.stockTransfer.create({
      data: { variantId: data.variantId, fromLocationId: data.fromLocationId, toLocationId: data.toLocationId, qty: data.qty, note: data.note ?? undefined, createdById: req.userId },
    });
  });
  res.status(201).json(transfer);
});

// ─── Stocktakes ───────────────────────────────────────────────────────────────

router.get('/stocktakes', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.stocktake.findMany({ include: { rows: true }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.stocktake.count(),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/stocktakes', async (req, res) => {
  const body = z.object({ locationId: z.string().uuid().nullish(), notes: z.string().nullish() }).parse(req.body);
  let locationId = body.locationId;
  if (!locationId) {
    const loc = await prisma.location.findFirst({ where: { isDefault: true } })
      ?? await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!loc) return res.status(422).json({ error: 'No location found. Create a location first.' });
    locationId = loc.id;
  }
  const st = await prisma.stocktake.create({ data: { locationId, notes: body.notes ?? undefined }, include: { rows: true } });
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
  const row = await prisma.stocktakeRow.create({
    data: { stocktakeId: st.id, variantId, countedQty, systemQty, variance: countedQty - systemQty },
  });
  res.status(201).json(row);
});

async function commitStocktake(req: any, res: any) {
  const st = await prisma.stocktake.findUnique({ where: { id: req.params.id }, include: { rows: true } });
  if (!st || st.status !== 'draft') return res.status(422).json({ error: 'Stocktake is not in draft' });
  await prisma.$transaction(async (tx: any) => {
    for (const row of st.rows) {
      if (Number(row.variance) !== 0) {
        await adjustStock(tx, row.variantId, st.locationId, Number(row.variance), 'stocktake_adjustment', {
          referenceType: 'stocktake', referenceId: st.id,
        });
      }
    }
    await tx.stocktake.update({ where: { id: st.id }, data: { status: 'committed' } });
  });
  res.json({ message: 'Stocktake committed', id: st.id });
}

router.post('/stocktakes/:id/commit', commitStocktake);
router.post('/stocktakes/:id/complete', commitStocktake);

router.patch('/stocktakes/:id', async (req, res) => {
  const data = z.object({ notes: z.string().nullish(), locationId: z.string().uuid().optional() }).parse(req.body);
  const item = await prisma.stocktake.update({ where: { id: req.params.id }, data, include: { rows: true } });
  res.json(item);
});

router.delete('/stocktakes/:id', async (req, res) => {
  await prisma.stocktake.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.get('/stocktakes/:id/rows', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { stocktakeId: req.params.id };
  const [items, total] = await Promise.all([
    prisma.stocktakeRow.findMany({ where, skip, take }),
    prisma.stocktakeRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.patch('/stocktake-rows/:id', async (req, res) => {
  const { countedQty } = z.object({ countedQty: z.coerce.number().min(0) }).parse(req.body);
  // Recalculate variance
  const existing = await prisma.stocktakeRow.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const item = await prisma.stocktakeRow.update({
    where: { id: req.params.id },
    data: { countedQty, variance: countedQty - Number(existing.systemQty) },
  });
  res.json(item);
});

router.delete('/stocktake-rows/:id', async (req, res) => {
  await prisma.stocktakeRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
