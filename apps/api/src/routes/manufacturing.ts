import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// ── BOMs ──────────────────────────────────────────────────────────────────────
router.get('/boms', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([prisma.bOM.findMany({ include: { rows: true }, skip, take }), prisma.bOM.count()]);
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
  const bom = await prisma.bOM.findUnique({ where: { id: req.params.id }, include: { rows: true, operations: true } });
  if (!bom) return res.status(404).json({ error: 'Not found' });
  res.json(bom);
});

router.patch('/boms/:id', async (req, res) => {
  const data = z.object({ name: z.string().nullish(), qty: z.number().nullish(), notes: z.string().nullish(), isActive: z.boolean().nullish() }).parse(req.body);
  const cleanData = Object.fromEntries(Object.entries(data).filter(([,v]) => v != null)) as any;
  const bom = await prisma.bOM.update({ where: { id: req.params.id }, data: cleanData, include: { rows: true } });
  res.json(bom);
});

// ── Manufacturing Orders ──────────────────────────────────────────────────────
const moInclude = { recipeRows: true, operationRows: true };

router.get('/orders', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([prisma.manufacturingOrder.findMany({ where, include: moInclude, skip, take, orderBy: { createdAt: 'desc' } }), prisma.manufacturingOrder.count({ where })]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/orders', async (req, res) => {
  const data = z.object({
    number: z.string(), bomId: z.string().uuid().nullish(), productId: z.string().uuid(),
    variantId: z.string().uuid().nullish(), locationId: z.string().uuid().nullish(),
    qtyPlanned: z.number(), plannedStart: z.string().nullish(), plannedEnd: z.string().nullish(), notes: z.string().nullish(),
  }).parse(req.body);

  const mo = await prisma.$transaction(async (tx) => {
    const mo = await tx.manufacturingOrder.create({
      data: {
        number: data.number, bomId: data.bomId ?? undefined, productId: data.productId,
        variantId: data.variantId ?? undefined, locationId: data.locationId ?? undefined,
        qtyPlanned: data.qtyPlanned,
        plannedStart: data.plannedStart ? new Date(data.plannedStart) : undefined,
        plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : undefined,
        notes: data.notes ?? undefined,
      },
    });
    if (data.bomId) {
      const bom = await tx.bOM.findUnique({ where: { id: data.bomId }, include: { rows: true } });
      if (bom) {
        const multiplier = data.qtyPlanned / Number(bom.qty);
        for (const br of bom.rows) {
          await tx.mORecipeRow.create({ data: { moId: mo.id, materialId: br.materialId ?? undefined, variantId: br.variantId ?? undefined, qtyPlanned: Number(br.qty) * multiplier } });
        }
      }
    }
    return mo;
  });
  const result = await prisma.manufacturingOrder.findUnique({ where: { id: mo.id }, include: moInclude });
  res.status(201).json(result);
});

router.get('/orders/:id', async (req, res) => {
  const mo = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id }, include: moInclude });
  if (!mo) return res.status(404).json({ error: 'Not found' });
  res.json(mo);
});

router.patch('/orders/:id', async (req, res) => {
  const data = z.object({ status: z.string().nullish(), qtyPlanned: z.number().nullish(), plannedStart: z.string().nullish(), plannedEnd: z.string().nullish(), notes: z.string().nullish(), locationId: z.string().uuid().nullish() }).parse(req.body);
  const moData: any = Object.fromEntries(Object.entries(data).filter(([,v]) => v != null));
  if (data.plannedStart !== undefined) moData.plannedStart = data.plannedStart ? new Date(data.plannedStart) : undefined;
  if (data.plannedEnd !== undefined) moData.plannedEnd = data.plannedEnd ? new Date(data.plannedEnd) : undefined;
  const mo = await prisma.manufacturingOrder.update({ where: { id: req.params.id }, data: moData, include: moInclude });
  res.json(mo);
});

router.post('/orders/:id/produce', async (req, res) => {
  const { qty } = z.object({ qty: z.number().positive() }).parse(req.body);
  const mo = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id }, include: moInclude });
  if (!mo) return res.status(404).json({ error: 'Not found' });
  if (!['planned','in_progress'].includes(mo.status)) return res.status(422).json({ error: `Cannot produce from MO in status '${mo.status}'` });
  if (!mo.locationId) return res.status(422).json({ error: 'MO must have a location' });
  if (!mo.variantId) return res.status(422).json({ error: 'MO must have a variant' });

  const ratio = qty / Number(mo.qtyPlanned);

  await prisma.$transaction(async (tx) => {
    for (const rr of mo.recipeRows) {
      if (rr.variantId) {
        const consumeQty = Number(rr.qtyPlanned) * ratio;
        await adjustStock(tx, rr.variantId, mo.locationId!, -consumeQty, 'mo_material_consumption', { referenceType: 'manufacturing_order', referenceId: mo.id, note: `MO ${mo.number}` });
        await tx.mORecipeRow.update({ where: { id: rr.id }, data: { qtyConsumed: { increment: consumeQty } } });
      }
    }
    await adjustStock(tx, mo.variantId!, mo.locationId!, qty, 'mo_production_output', { referenceType: 'manufacturing_order', referenceId: mo.id, note: `MO ${mo.number}` });
  });

  const newProduced = Number(mo.qtyProduced) + qty;
  const status = newProduced >= Number(mo.qtyPlanned) ? 'done' : 'in_progress';
  const updated = await prisma.manufacturingOrder.update({ where: { id: mo.id }, data: { qtyProduced: newProduced, status }, include: moInclude });
  res.json(updated);
});

export default router;
