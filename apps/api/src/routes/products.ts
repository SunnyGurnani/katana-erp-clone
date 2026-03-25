import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

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
  trackLots: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  salesPrice: z.coerce.number().optional(),
  purchasePrice: z.coerce.number().optional(),
  variants: z.array(variantSchema).optional(),
});

const include = { variants: true };

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = req.query.search
    ? { name: { contains: req.query.search as string } }
    : {};
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { name: 'asc' }, include }),
    prisma.product.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const { variants, ...data } = schema.parse(req.body);
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
      trackLots: data.trackLots,
      trackExpiry: data.trackExpiry,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
      variants: variantData?.length ? { create: variantData } : undefined,
    },
    include,
  });
  res.status(201).json(product);
});

// ── Standalone BOM Rows (must be before /:id) ─────────────────────────────────
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

router.post('/bom-rows', async (req, res) => {
  const data = z.object({
    bomId: z.string().uuid(),
    materialId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    qty: z.coerce.number().positive(),
    unitCost: z.coerce.number().optional(),
    notes: z.string().optional(),
  }).parse(req.body);
  const item = await prisma.bOMRow.create({ data });
  res.status(201).json(item);
});

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

router.get('/bom-rows/:id', async (req, res) => {
  const item = await prisma.bOMRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/bom-rows/:id', async (req, res) => {
  const data = z.object({ materialId: z.string().uuid().optional(), variantId: z.string().uuid().optional(), qty: z.coerce.number().positive().optional(), unitCost: z.coerce.number().optional(), notes: z.string().optional() }).parse(req.body);
  const item = await prisma.bOMRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/bom-rows/:id', async (req, res) => {
  await prisma.bOMRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ── Product Operation Rerank (must be before /:id) ────────────────────────────
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

// ── Product CRUD by ID ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id }, include });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

router.put('/:id', async (req, res) => {
  const { variants, ...data } = schema.partial().parse(req.body);
  const p = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      sku: data.sku,
      description: data.description ?? undefined,
      category: data.category ?? undefined,
      isManufactured: data.isManufactured,
      trackLots: data.trackLots,
      trackExpiry: data.trackExpiry,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
    },
    include,
  });
  res.json(p);
});

router.patch('/:id', async (req, res) => {
  const { variants, ...data } = schema.partial().parse(req.body);
  const p = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      sku: data.sku,
      description: data.description ?? undefined,
      category: data.category ?? undefined,
      isManufactured: data.isManufactured,
      trackLots: data.trackLots,
      trackExpiry: data.trackExpiry,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
    },
    include,
  });
  res.json(p);
});

router.delete('/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
