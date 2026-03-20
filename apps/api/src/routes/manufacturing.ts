import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';
import moProductionsRouter from './moProductions';

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

// MO Productions sub-routes
router.use(moProductionsRouter);

export default router;

// ── MO Make-to-Order ──────────────────────────────────────────────────────────
// POST /manufacturing_order_make_to_order — link MO to SO row
router.post('/orders/:id/make-to-order', async (req, res) => {
  const { soRowId } = z.object({ soRowId: z.string().uuid() }).parse(req.body);
  const mo = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id } });
  if (!mo) return res.status(404).json({ error: 'MO not found' });
  // Store make-to-order linkage in notes (real impl would use a join table)
  const updated = await prisma.manufacturingOrder.update({
    where: { id: req.params.id },
    data: { notes: `${mo.notes ? mo.notes + '\n' : ''}[make-to-order: soRowId=${soRowId}]` },
  });
  res.json({ moId: updated.id, soRowId, linked: true });
});

// POST /manufacturing_order_unlink — remove MO from SO
router.post('/orders/:id/unlink', async (req, res) => {
  const mo = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id } });
  if (!mo) return res.status(404).json({ error: 'MO not found' });
  const updated = await prisma.manufacturingOrder.update({
    where: { id: req.params.id },
    data: { notes: (mo.notes || '').replace(/\[make-to-order:.*?\]/g, '').trim() || null },
  });
  res.json({ moId: updated.id, unlinked: true });
});

// ── Standalone MO Recipe Rows ─────────────────────────────────────────────────
router.get('/recipe-rows', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { moId } = req.query as Record<string, string>;
  const where: any = {};
  if (moId) where.moId = moId;
  const [items, total] = await Promise.all([
    prisma.mORecipeRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.mORecipeRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/recipe-rows', async (req, res) => {
  const data = z.object({
    moId: z.string().uuid(),
    materialId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    qtyPlanned: z.coerce.number().positive(),
  }).parse(req.body);
  const item = await prisma.mORecipeRow.create({ data });
  res.status(201).json(item);
});

router.get('/recipe-rows/:id', async (req, res) => {
  const item = await prisma.mORecipeRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/recipe-rows/:id', async (req, res) => {
  const data = z.object({ materialId: z.string().uuid().optional(), variantId: z.string().uuid().optional(), qtyPlanned: z.coerce.number().positive().optional() }).parse(req.body);
  const item = await prisma.mORecipeRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/recipe-rows/:id', async (req, res) => {
  await prisma.mORecipeRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ── Standalone MO Operation Rows ──────────────────────────────────────────────
router.get('/operation-rows', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { moId } = req.query as Record<string, string>;
  const where: any = {};
  if (moId) where.moId = moId;
  const [items, total] = await Promise.all([
    prisma.mOOperationRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.mOOperationRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/operation-rows', async (req, res) => {
  const data = z.object({
    moId: z.string().uuid(),
    operationId: z.string().uuid().optional(),
    name: z.string(),
    status: z.string().default('pending'),
    actualMinutes: z.coerce.number().optional(),
  }).parse(req.body);
  const item = await prisma.mOOperationRow.create({ data });
  res.status(201).json(item);
});

router.get('/operation-rows/:id', async (req, res) => {
  const item = await prisma.mOOperationRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/operation-rows/:id', async (req, res) => {
  const data = z.object({ name: z.string().optional(), status: z.string().optional(), actualMinutes: z.coerce.number().optional() }).parse(req.body);
  const item = await prisma.mOOperationRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/operation-rows/:id', async (req, res) => {
  await prisma.mOOperationRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
