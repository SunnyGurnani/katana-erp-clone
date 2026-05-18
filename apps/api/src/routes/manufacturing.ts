/**
 * Manufacturing: BOMs, manufacturing orders (MO), recipe/operation rows, and production.
 * @openapi
 * tags:
 *   - name: Manufacturing
 *     description: BOMs, MOs, material consumption, and output
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';
import moProductionsRouter from './moProductions';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

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
/**
 * @openapi
 * /manufacturing/boms:
 *   get:
 *     summary: List BOMs (paginated)
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated BOMs with rows and operations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { type: object } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
router.get('/boms', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([prisma.bOM.findMany({ include: bomInclude, skip, take }), prisma.bOM.count()]);
  res.json(paginated(items, total, page, pageSize));
});

/**
 * @openapi
 * /manufacturing/boms:
 *   post:
 *     summary: Create a BOM with component rows
 *     tags: [Manufacturing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, name]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               variantId: { type: string, format: uuid, nullable: true }
 *               name: { type: string }
 *               qty: { type: number, default: 1 }
 *               notes: { type: string, nullable: true }
 *               isActive: { type: boolean, default: true }
 *               rows:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [qty]
 *                   properties:
 *                     materialId: { type: string, format: uuid, nullable: true }
 *                     variantId: { type: string, format: uuid, nullable: true }
 *                     qty: { type: number }
 *                     unitCost: { type: number, nullable: true }
 *                     notes: { type: string, nullable: true }
 *     responses:
 *       '201':
 *         description: Created BOM
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/boms', async (req, res) => {
  const data = z.object({
    productId: z.string().uuid(), variantId: z.string().uuid().nullish(), name: z.string(), qty: z.number().default(1), notes: z.string().nullish(), isActive: z.boolean().default(true),
    rows: z.array(z.object({ materialId: z.string().uuid().nullish(), variantId: z.string().uuid().nullish(), qty: z.number(), unitCost: z.number().nullish(), notes: z.string().nullish() })).default([]),
  }).parse(req.body);
  const bom = await prisma.bOM.create({ data: { productId: data.productId, variantId: data.variantId ?? undefined, name: data.name, qty: data.qty, notes: data.notes ?? undefined, isActive: data.isActive, rows: { create: data.rows } }, include: { rows: true } });
  res.status(201).json(bom);
});

/**
 * @openapi
 * /manufacturing/boms/{id}:
 *   get:
 *     summary: Get a BOM by id
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: BOM with rows and operations
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/boms/:id', async (req, res) => {
  const bom = await prisma.bOM.findUnique({ where: { id: req.params.id }, include: bomInclude });
  if (!bom) return res.status(404).json({ error: 'Not found' });
  res.json(bom);
});

/**
 * @openapi
 * /manufacturing/boms/{id}:
 *   patch:
 *     summary: Partially update BOM metadata
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, nullable: true }
 *               qty: { type: number, nullable: true }
 *               notes: { type: string, nullable: true }
 *               isActive: { type: boolean, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated BOM
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.patch('/boms/:id', async (req, res) => {
  const data = z.object({ name: z.string().nullish(), qty: z.number().nullish(), notes: z.string().nullish(), isActive: z.boolean().nullish() }).parse(req.body);
  const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null)) as any;
  const bom = await prisma.bOM.update({ where: { id: req.params.id }, data: cleanData, include: { rows: true } });
  res.json(bom);
});

// ── Manufacturing Orders ──────────────────────────────────────────────────────
/**
 * @openapi
 * /manufacturing/orders:
 *   get:
 *     summary: List manufacturing orders (paginated)
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated normalized MOs (moNumber, qty, completedQty, scheduledAt)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { type: object } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
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

/**
 * @openapi
 * /manufacturing/orders:
 *   post:
 *     summary: Create a manufacturing order (optionally expand recipe from BOM)
 *     tags: [Manufacturing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               number: { type: string }
 *               bomId: { type: string, format: uuid, nullable: true }
 *               productId: { type: string, format: uuid }
 *               variantId: { type: string, format: uuid, nullable: true }
 *               locationId: { type: string, format: uuid, nullable: true }
 *               qty: { type: number, default: 1 }
 *               qtyPlanned: { type: number }
 *               scheduledAt: { type: string, nullable: true }
 *               plannedStart: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       '201':
 *         description: Created MO (normalized)
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '400':
 *         description: Missing productId when required
 */
router.post('/orders', async (req, res) => {
  const data = z.object({
    number: z.string().optional(),
    bomId: z.string().uuid().nullish(),
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().nullish(),
    locationId: z.string().min(1).nullish(),
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

  const mo = await prisma.$transaction(async (tx: any) => {
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

/**
 * @openapi
 * /manufacturing/orders/{id}:
 *   get:
 *     summary: Get a manufacturing order by id
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Normalized MO with BOM, recipe rows, operations
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/orders/:id', async (req, res) => {
  const mo = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id }, include: moInclude });
  if (!mo) return res.status(404).json({ error: 'Not found' });
  res.json(normalizeMo(mo));
});

/**
 * @openapi
 * /manufacturing/orders/{id}:
 *   patch:
 *     summary: Partially update manufacturing order
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, nullable: true }
 *               qtyPlanned: { type: number, nullable: true }
 *               scheduledAt: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *               locationId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated MO (normalized)
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.patch('/orders/:id', async (req, res) => {
  const data = z.object({
    status: z.string().nullish(), qtyPlanned: z.number().nullish(), scheduledAt: z.string().nullish(),
    notes: z.string().nullish(), locationId: z.string().min(1).nullish(),
  }).parse(req.body);
  const moData: any = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null));
  if ('scheduledAt' in data) {
    moData.plannedStart = data.scheduledAt ? new Date(data.scheduledAt) : null;
    delete moData.scheduledAt;
  }
  const mo = await prisma.manufacturingOrder.update({ where: { id: req.params.id }, data: moData, include: moInclude });
  res.json(normalizeMo(mo));
});

/**
 * @openapi
 * /manufacturing/orders/{id}/produce:
 *   post:
 *     summary: Record production run (consume recipe materials, add finished output)
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               qty: { type: number, minimum: 0, exclusiveMinimum: true }
 *               locationId: { type: string, format: uuid }
 *               sourceLocationId: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Updated MO after production
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 *       '422':
 *         description: Invalid status, location, or nothing left to produce
 */
router.post('/orders/:id/produce', async (req, res) => {
  const body = z.object({
    qty: z.coerce.number().positive().optional(),
    locationId: z.string().min(1).optional(),
    sourceLocationId: z.string().min(1).optional(),
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

  await prisma.$transaction(async (tx: any) => {
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
/**
 * @openapi
 * /manufacturing/orders/{id}/make-to-order:
 *   post:
 *     summary: Link MO to a sales order line (stored in notes)
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [soRowId]
 *             properties:
 *               soRowId: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Link confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 moId: { type: string, format: uuid }
 *                 soRowId: { type: string, format: uuid }
 *                 linked: { type: boolean }
 *       '404':
 *         description: MO not found
 */
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
/**
 * @openapi
 * /manufacturing/orders/{id}/unlink:
 *   post:
 *     summary: Remove make-to-order marker from MO notes
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Unlink confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 moId: { type: string, format: uuid }
 *                 unlinked: { type: boolean }
 *       '404':
 *         description: MO not found
 */
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
/**
 * @openapi
 * /manufacturing/recipe-rows:
 *   get:
 *     summary: List MO recipe rows (paginated, optional filter by moId)
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: query
 *         name: moId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated recipe rows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { type: object } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
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

/**
 * @openapi
 * /manufacturing/recipe-rows:
 *   post:
 *     summary: Create a standalone MO recipe row
 *     tags: [Manufacturing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [moId, qtyPlanned]
 *             properties:
 *               moId: { type: string, format: uuid }
 *               materialId: { type: string, format: uuid }
 *               variantId: { type: string, format: uuid }
 *               qtyPlanned: { type: number, minimum: 0, exclusiveMinimum: true }
 *     responses:
 *       '201':
 *         description: Created recipe row
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
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

/**
 * @openapi
 * /manufacturing/recipe-rows/{id}:
 *   get:
 *     summary: Get a MO recipe row by id
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Recipe row
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/recipe-rows/:id', async (req, res) => {
  const item = await prisma.mORecipeRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

/**
 * @openapi
 * /manufacturing/recipe-rows/{id}:
 *   patch:
 *     summary: Update a MO recipe row
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               materialId: { type: string, format: uuid }
 *               variantId: { type: string, format: uuid }
 *               qtyPlanned: { type: number, minimum: 0, exclusiveMinimum: true }
 *     responses:
 *       '200':
 *         description: Updated recipe row
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.patch('/recipe-rows/:id', async (req, res) => {
  const data = z.object({ materialId: z.string().uuid().optional(), variantId: z.string().uuid().optional(), qtyPlanned: z.coerce.number().positive().optional() }).parse(req.body);
  const item = await prisma.mORecipeRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

/**
 * @openapi
 * /manufacturing/recipe-rows/{id}:
 *   delete:
 *     summary: Delete a MO recipe row
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Deleted
 */
router.delete('/recipe-rows/:id', async (req, res) => {
  await prisma.mORecipeRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ── Standalone MO Operation Rows ──────────────────────────────────────────────
/**
 * @openapi
 * /manufacturing/operation-rows:
 *   get:
 *     summary: List MO operation rows (paginated, optional filter by moId)
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: query
 *         name: moId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated operation rows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { type: object } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
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

/**
 * @openapi
 * /manufacturing/operation-rows:
 *   post:
 *     summary: Create an MO operation row
 *     tags: [Manufacturing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [moId, name]
 *             properties:
 *               moId: { type: string, format: uuid }
 *               operationId: { type: string, format: uuid }
 *               name: { type: string }
 *               status: { type: string, default: pending }
 *               actualMinutes: { type: number }
 *               operatorId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       '201':
 *         description: Created operation row
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/operation-rows', async (req, res) => {
  const data = z.object({
    moId: z.string().uuid(),
    operationId: z.string().uuid().optional(),
    name: z.string(),
    status: z.string().default('pending'),
    actualMinutes: z.coerce.number().optional(),
    operatorId: z.string().uuid().nullish(),
  }).parse(req.body);
  const item = await prisma.mOOperationRow.create({ data });
  res.status(201).json(item);
});

/**
 * @openapi
 * /manufacturing/operation-rows/{id}:
 *   get:
 *     summary: Get an MO operation row by id
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Operation row
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/operation-rows/:id', async (req, res) => {
  const item = await prisma.mOOperationRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

/**
 * @openapi
 * /manufacturing/operation-rows/{id}:
 *   patch:
 *     summary: Update an MO operation row
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               status: { type: string }
 *               actualMinutes: { type: number }
 *               operatorId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated operation row
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.patch('/operation-rows/:id', async (req, res) => {
  const data = z.object({ name: z.string().optional(), status: z.string().optional(), actualMinutes: z.coerce.number().optional(), operatorId: z.string().uuid().nullish() }).parse(req.body);
  const item = await prisma.mOOperationRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

/**
 * @openapi
 * /manufacturing/operation-rows/{id}:
 *   delete:
 *     summary: Delete an MO operation row
 *     tags: [Manufacturing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Deleted
 */
router.delete('/operation-rows/:id', async (req, res) => {
  await prisma.mOOperationRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
