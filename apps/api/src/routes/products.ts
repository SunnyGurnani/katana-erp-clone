/**
 * Products: catalog CRUD, BOM rows, product operations, and operation rerank.
 * @openapi
 * tags:
 *   - name: Products
 *     description: Product master data and related BOM/operation helpers
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';
import { resolveBomRowUnitCost } from '../lib/bomCost';
import { buildVariantNames, generateVariantsSchema } from '../lib/variantGenerate';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const variantSchema = z.object({
  name: z.string().default('Default'),
  sku: z.string().optional(),
  salesPrice: z.coerce.number().optional(),
  salePrice: z.coerce.number().optional(),
  purchasePrice: z.coerce.number().optional(),
  unitCost: z.coerce.number().optional(),
});

const schema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().nullish(),
  category: z.string().nullish(),
  status: z.string().default('active'),
  isManufactured: z.boolean().optional(),
  trackLotsAndExpiry: z.boolean().optional(),
  trackLots: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  salesPrice: z.coerce.number().optional(),
  purchasePrice: z.coerce.number().optional(),
  unitOfMeasure: z.string().min(1).optional(),
  hasVariants: z.boolean().optional(),
  variantOptions: z.array(z.object({
    name: z.string().min(1),
    values: z.array(z.string().min(1)).min(1),
  })).optional(),
  variants: z.array(variantSchema).optional(),
});

function resolveTrackLots(data: any) {
  const { trackLots, trackExpiry, ...rest } = data;
  if (trackLots !== undefined || trackExpiry !== undefined) {
    rest.trackLotsAndExpiry = !!(trackLots || trackExpiry);
  }
  return rest;
}

function withTrackFields(product: any) {
  return {
    ...product,
    trackLots: !!product.trackLotsAndExpiry,
    trackExpiry: !!product.trackLotsAndExpiry,
  };
}

const include = { variants: true };

/**
 * @openapi
 * /products:
 *   get:
 *     summary: List products (paginated, optional name search)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: search
 *         description: Filter by name contains
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated products with variants
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
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = req.query.search
    ? { name: { contains: req.query.search as string } }
    : {};
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { name: 'asc' }, include }),
    prisma.product.count({ where }),
  ]);
  res.json(paginated(items.map(withTrackFields), total, page, pageSize));
});

/**
 * @openapi
 * /products:
 *   post:
 *     summary: Create a product with optional variants
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               sku: { type: string }
 *               description: { type: string, nullable: true }
 *               category: { type: string, nullable: true }
 *               status: { type: string, default: active }
 *               isManufactured: { type: boolean }
 *               salesPrice: { type: number }
 *               purchasePrice: { type: number }
 *               variants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string, default: Default }
 *                     sku: { type: string }
 *                     salesPrice: { type: number }
 *                     salePrice: { type: number }
 *                     purchasePrice: { type: number }
 *                     unitCost: { type: number }
 *     responses:
 *       '201':
 *         description: Created product with variants
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/', async (req, res) => {
  const { variants, ...rawData } = schema.parse(req.body);
  const data = resolveTrackLots(rawData);
  const variantData = variants?.map(v => ({
    name: v.name,
    sku: v.sku,
    salesPrice: v.salesPrice ?? v.salePrice,
    purchasePrice: v.purchasePrice ?? v.unitCost,
  }));
  const product = await prisma.product.create({
    data: {
      name: data.name,
      sku: data.sku,
      description: data.description ?? undefined,
      category: data.category ?? undefined,
      isManufactured: data.isManufactured,
      trackLotsAndExpiry: data.trackLotsAndExpiry ?? undefined,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
      unitOfMeasure: data.unitOfMeasure?.trim() || 'pcs',
      variants: variantData?.length ? { create: variantData } : undefined,
    },
    include,
  });
  res.status(201).json(withTrackFields(product));
});

// ── Standalone BOM Rows (must be before /:id) ─────────────────────────────────
/**
 * @openapi
 * /products/bom-rows:
 *   get:
 *     summary: List BOM component rows (paginated, optional bomId)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: bomId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated BOM rows
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
router.get('/bom-rows', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { bomId } = req.query as Record<string, string>;
  const where: any = {};
  if (bomId) where.bomId = bomId;
  const [items, total] = await Promise.all([
    prisma.bOMRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.bOMRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

/**
 * @openapi
 * /products/bom-rows:
 *   post:
 *     summary: Create a single BOM row
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bomId, qty]
 *             properties:
 *               bomId: { type: string, format: uuid }
 *               materialId: { type: string, format: uuid }
 *               variantId: { type: string, format: uuid }
 *               qty: { type: number, minimum: 0, exclusiveMinimum: true }
 *               unitCost: { type: number }
 *               notes: { type: string }
 *     responses:
 *       '201':
 *         description: Created BOM row
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/bom-rows', async (req, res) => {
  const data = z.object({
    bomId: z.string().uuid(),
    materialId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    qty: z.coerce.number().positive(),
    unitCost: z.coerce.number().optional(),
    notes: z.string().optional(),
  }).parse(req.body);
  const unitCost = await resolveBomRowUnitCost(data.materialId, data.unitCost);
  const item = await prisma.bOMRow.create({
    data: { ...data, unitCost: unitCost ?? data.unitCost ?? undefined },
  });
  res.status(201).json(item);
});

/**
 * @openapi
 * /products/bom-rows/batch:
 *   post:
 *     summary: Create multiple BOM rows in one request
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rows]
 *             properties:
 *               rows:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [bomId, qty]
 *                   properties:
 *                     bomId: { type: string, format: uuid }
 *                     materialId: { type: string, format: uuid }
 *                     variantId: { type: string, format: uuid }
 *                     qty: { type: number, minimum: 0, exclusiveMinimum: true }
 *                     unitCost: { type: number }
 *                     notes: { type: string }
 *     responses:
 *       '201':
 *         description: Created BOM rows
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object }
 */
router.post('/bom-rows/batch', async (req, res) => {
  const { rows } = z.object({
    rows: z.array(z.object({
      bomId: z.string().uuid(),
      materialId: z.string().uuid().optional(),
      variantId: z.string().uuid().optional(),
      qty: z.coerce.number().positive(),
      unitCost: z.coerce.number().optional(),
      notes: z.string().optional(),
    })),
  }).parse(req.body);
  const items = await prisma.$transaction(rows.map(r => prisma.bOMRow.create({ data: r })));
  res.status(201).json(items);
});

/**
 * @openapi
 * /products/bom-rows/{id}:
 *   get:
 *     summary: Get a BOM row by id
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: BOM row
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/bom-rows/:id', async (req, res) => {
  const item = await prisma.bOMRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

/**
 * @openapi
 * /products/bom-rows/{id}:
 *   patch:
 *     summary: Update a BOM row
 *     tags: [Products]
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
 *               qty: { type: number, minimum: 0, exclusiveMinimum: true }
 *               unitCost: { type: number }
 *               notes: { type: string }
 *     responses:
 *       '200':
 *         description: Updated BOM row
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.patch('/bom-rows/:id', async (req, res) => {
  const data = z.object({ materialId: z.string().uuid().optional(), variantId: z.string().uuid().optional(), qty: z.coerce.number().positive().optional(), unitCost: z.coerce.number().optional(), notes: z.string().optional() }).parse(req.body);
  const existing = await prisma.bOMRow.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const materialId = data.materialId ?? existing.materialId;
  const unitCost = await resolveBomRowUnitCost(
    materialId,
    data.unitCost !== undefined ? data.unitCost : existing.unitCost ? Number(existing.unitCost) : undefined,
  );
  const item = await prisma.bOMRow.update({
    where: { id: req.params.id },
    data: { ...data, unitCost: unitCost ?? data.unitCost ?? undefined },
  });
  res.json(item);
});

/**
 * @openapi
 * /products/bom-rows/{id}:
 *   delete:
 *     summary: Delete a BOM row
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Deleted
 */
router.delete('/bom-rows/:id', async (req, res) => {
  await prisma.bOMRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ── Product Operation Rerank (must be before /:id) ────────────────────────────
/**
 * @openapi
 * /products/operation-rerank:
 *   post:
 *     summary: Touch product operations for a BOM in given order (placeholder rerank)
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bomId, orderedIds]
 *             properties:
 *               bomId: { type: string, format: uuid }
 *               orderedIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Product operations for the BOM
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object }
 */
router.post('/operation-rerank', async (req, res) => {
  const { bomId, orderedIds } = z.object({
    bomId: z.string().uuid(),
    orderedIds: z.array(z.string().uuid()),
  }).parse(req.body);

  await prisma.$transaction(
    orderedIds.map((id) =>
      prisma.productOperation.updateMany({ where: { id, bomId }, data: {} }),
    ),
  );

  const ops = await prisma.productOperation.findMany({ where: { bomId }, orderBy: { id: 'asc' } });
  res.json(ops);
});

// ── Product Operation Rows (must be before /:id) ──────────────────────────────
/**
 * @openapi
 * /products/operation-rows:
 *   get:
 *     summary: List product operations (paginated, optional bomId)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: bomId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated product operations
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
  const { bomId } = req.query as Record<string, string>;
  const where: any = {};
  if (bomId) where.bomId = bomId;
  const [items, total] = await Promise.all([
    prisma.productOperation.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
    prisma.productOperation.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// ── Generate variants from option dimensions (Katana-style) ───────────────────
router.post('/:id/variants/generate', async (req, res) => {
  const productId = req.params.id;
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const { options, replaceExisting } = generateVariantsSchema.parse(req.body);
  const names = buildVariantNames(options);
  if (names.length === 0) return res.status(400).json({ error: 'At least one option value is required' });

  const result = await prisma.$transaction(async (tx) => {
    if (replaceExisting && product.variants.length > 0) {
      await tx.variant.deleteMany({ where: { productId } });
    }
    const existingNames = new Set(
      replaceExisting ? [] : product.variants.map((v) => v.name.toLowerCase()),
    );
    const toCreate = names.filter((n) => !existingNames.has(n.toLowerCase()));
    if (toCreate.length > 0) {
      await tx.variant.createMany({
        data: toCreate.map((name) => ({
          productId,
          name,
          sku: name.replace(/\s+/g, '-').toLowerCase().slice(0, 64) || undefined,
        })),
      });
    }
    return tx.product.update({
      where: { id: productId },
      data: {
        hasVariants: true,
        variantOptions: options as object,
      },
      include,
    });
  });

  res.json(withTrackFields(result));
});

// ── Product CRUD by ID ────────────────────────────────────────────────────────
/**
 * @openapi
 * /products/{id}:
 *   get:
 *     summary: Get a product by id
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Product with variants
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/:id', async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id }, include });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(withTrackFields(p));
});

/**
 * @openapi
 * /products/{id}:
 *   put:
 *     summary: Replace/update product fields (variants key ignored for nested create)
 *     tags: [Products]
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
 *               sku: { type: string }
 *               description: { type: string, nullable: true }
 *               category: { type: string, nullable: true }
 *               isManufactured: { type: boolean }
 *               salesPrice: { type: number }
 *               purchasePrice: { type: number }
 *     responses:
 *       '200':
 *         description: Updated product
 *         content:
 *           application/json:
 *             schema: { type: object }
 *   patch:
 *     summary: Partially update product fields
 *     tags: [Products]
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
 *               sku: { type: string }
 *               description: { type: string, nullable: true }
 *               category: { type: string, nullable: true }
 *               isManufactured: { type: boolean }
 *               salesPrice: { type: number }
 *               purchasePrice: { type: number }
 *     responses:
 *       '200':
 *         description: Updated product
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.put('/:id', async (req, res) => {
  const { variants, ...rawData } = schema.partial().parse(req.body);
  const data = resolveTrackLots(rawData);
  const p = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      sku: data.sku,
      description: data.description ?? undefined,
      category: data.category ?? undefined,
      isManufactured: data.isManufactured,
      trackLotsAndExpiry: data.trackLotsAndExpiry,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
      unitOfMeasure: data.unitOfMeasure,
      hasVariants: data.hasVariants,
      variantOptions: data.variantOptions as object | undefined,
    },
    include,
  });
  res.json(withTrackFields(p));
});

router.patch('/:id', async (req, res) => {
  const { variants, ...rawData } = schema.partial().parse(req.body);
  const data = resolveTrackLots(rawData);
  const p = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      sku: data.sku,
      description: data.description ?? undefined,
      category: data.category ?? undefined,
      isManufactured: data.isManufactured,
      trackLotsAndExpiry: data.trackLotsAndExpiry,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
      unitOfMeasure: data.unitOfMeasure,
      hasVariants: data.hasVariants,
      variantOptions: data.variantOptions as object | undefined,
    },
    include,
  });
  res.json(withTrackFields(p));
});

/**
 * @openapi
 * /products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Deleted
 */
router.delete('/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
