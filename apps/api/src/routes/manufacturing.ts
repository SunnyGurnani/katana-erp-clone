import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

async function nextMoNumber(): Promise<string> {
  const count = await prisma.manufacturingOrder.count();
  return `MO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

const bomInclude = { rows: true, operations: true };
const moInclude = {
  bom: { include: { rows: true } },
  recipeRows: true,
  operationRows: true,
  product: { select: { id: true, name: true, sku: true } },
};

function normalizeMo(mo: any) {
  return { ...mo, moNumber: mo.number, qty: mo.qtyPlanned, completedQty: mo.qtyProduced, scheduledAt: mo.plannedStart };
}

// ── BOMs ──────────────────────────────────────────────────────────────────────
router.get('/boms', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([prisma.bOM.findMany({ include: bomInclude, skip, take }), prisma.bOM.count()]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/boms', async (req, res) => {
  const data = z.object({
    productId: z.string().uuid(), variantId: z.string().uuid().nullish(), name: z.string(), qty: z.number().default(1), notes: z.string().nullish(), isActive: z.boolean().default(true),
    rows: z.array(z.object({ materialId: z.string().uuid().nullish(), variantId: z.string().uuid().nullish(), qty: z.number(), unitCost: z.number().nullish(), notes: z.string().nullish() })).default([]),
  }).parse(req.body);
  const bom = await prisma.bOM.create({ data: { productId: data.productId, variantId: data.variantId ?? undefined, name: data.name, qty: data.qty, notes: data.notes ?? undefined, isActive: data.isActive, rows: { create: data.rows } }, include: { rows: true } });
  res.status(201).json(bom);
});

router.get('/boms/:id', async (req, res) => {
  const bom = await prisma.bOM.findUnique({ where: { id: req.params.id }, include: bomInclude });
  if (!bom) return res.status(404).json({ error: 'Not found' });
  res.json(bom);
});

router.patch('/boms/:id', async (req, res) => {
  const data = z.object({ name: z.string().nullish(), qty: z.number().nullish(), notes: z.string().nullish(), isActive: z.boolean().nullish() }).parse(req.body);
  const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null)) as any;
  const bom = await prisma.bOM.update({ where: { id: req.params.id }, data: cleanData, include: { rows: true } });
  res.json(bom);
});

// ── Manufacturing Orders ──────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.manufacturingOrder.findMany({ where, include: moInclude, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.manufacturingOrder.count({ where }),
  ]);
  res.json(paginated(items.map(normalizeMo), total, page, pageSize));
});

router.post('/orders', async (req, res) => {
  const data = z.object({
    number: z.string().optional(),
    bomId: z.string().uuid().nullish(),
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().nullish(),
    locationId: z.string().uuid().nullish(),
    qty: z.coerce.number().default(1),
    qtyPlanned: z.coerce.number().optional(),
    scheduledAt: z.string().nullish(),
    plannedStart: z.string().nullish(),
    notes: z.string().nullish(),
  }).parse(req.body);

  let productId = data.productId;
  let variantId = data.variantId;
  if (!productId && data.bomId) {
    const bom = await prisma.bOM.findUnique({ where: { id: data.bomId } });
    if (bom) { productId = bom.productId; variantId = variantId ?? bom.variantId ?? undefined; }
  }
  if (!productId) return res.status(400).json({ error: 'productId required (or provide bomId)' });

  const number = data.number || await nextMoNumber();
  const qtyPlanned = data.qtyPlanned ?? data.qty;

  const mo = await prisma.$transaction(async (tx) => {
    const created = await tx.manufacturingOrder.create({
      data: {
        number, bomId: data.bomId ?? undefined, productId, variantId: variantId ?? undefined,
        locationId: data.locationId ?? undefined, qtyPlanned,
        plannedStart: data.scheduledAt ? new Date(data.scheduledAt) : (data.plannedStart ? new Date(data.plannedStart) : undefined),
        notes: data.notes ?? undefined,
      },
    });
    if (data.bomId) {
      const bom = await tx.bOM.findUnique({ where: { id: data.bomId }, include: { rows: true } });
      if (bom) {
        const multiplier = qtyPlanned / Number(bom.qty);
        for (const br of bom.rows) {
          await tx.mORecipeRow.create({ data: { moId: created.id, materialId: br.materialId ?? undefined, variantId: br.variantId ?? undefined, qtyPlanned: Number(br.qty) * multiplier } });
        }
      }
    }
    return created;
  });
  const result = await prisma.manufacturingOrder.findUnique({ where: { id: mo.id }, include: moInclude });
  res.status(201).json(normalizeMo(result));
});

router.get('/orders/:id', async (req, res) => {
  const mo = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id }, include: moInclude });
  if (!mo) return res.status(404).json({ error: 'Not found' });
  res.json(normalizeMo(mo));
});

router.patch('/orders/:id', async (req, res) => {
  const data = z.object({
    status: z.string().nullish(), qtyPlanned: z.number().nullish(), scheduledAt: z.string().nullish(),
    notes: z.string().nullish(), locationId: z.string().uuid().nullish(),
  }).parse(req.body);
  const moData: any = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null));
  if ('scheduledAt' in data) {
    moData.plannedStart = data.scheduledAt ? new Date(data.scheduledAt) : null;
    delete moData.scheduledAt;
  }
  const mo = await prisma.manufacturingOrder.update({ where: { id: req.params.id }, data: moData, include: moInclude });
  res.json(normalizeMo(mo));
});

router.post('/orders/:id/produce', async (req, res) => {
  const body = z.object({
    qty: z.coerce.number().positive().optional(),
    locationId: z.string().uuid().optional(),
    sourceLocationId: z.string().uuid().optional(),
  }).parse(req.body);

  const mo = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id }, include: moInclude });
  if (!mo) return res.status(404).json({ error: 'Not found' });
  if (!['draft', 'released', 'planned', 'in_progress'].includes(mo.status)) {
    return res.status(422).json({ error: `Cannot produce from MO in status '${mo.status}'` });
  }

  const outputLocationId = body.locationId ?? mo.locationId;
  const sourceLocId = body.sourceLocationId ?? outputLocationId;
  if (!outputLocationId) return res.status(422).json({ error: 'Provide a locationId' });

  const qty = body.qty ?? Number(mo.qtyPlanned) - Number(mo.qtyProduced);
  if (qty <= 0) return res.status(422).json({ error: 'Nothing left to produce' });

  const ratio = Number(mo.qtyPlanned) > 0 ? qty / Number(mo.qtyPlanned) : 0;

  await prisma.$transaction(async (tx) => {
    for (const rr of mo.recipeRows) {
      if (rr.variantId && sourceLocId) {
        const consumeQty = Number(rr.qtyPlanned) * ratio;
        await adjustStock(tx, rr.variantId, sourceLocId, -consumeQty, 'mo_material_consumption', { referenceType: 'manufacturing_order', referenceId: mo.id, note: `MO ${mo.number}` });
        await tx.mORecipeRow.update({ where: { id: rr.id }, data: { qtyConsumed: { increment: consumeQty } } });
      }
    }
    if (mo.variantId) {
      await adjustStock(tx, mo.variantId, outputLocationId, qty, 'mo_production_output', { referenceType: 'manufacturing_order', referenceId: mo.id, note: `MO ${mo.number}` });
    }
  });

  const newProduced = Number(mo.qtyProduced) + qty;
  const status = newProduced >= Number(mo.qtyPlanned) ? 'done' : 'in_progress';
  const updated = await prisma.manufacturingOrder.update({ where: { id: mo.id }, data: { qtyProduced: newProduced, status }, include: moInclude });
  res.json(normalizeMo(updated));
});

export default router;
