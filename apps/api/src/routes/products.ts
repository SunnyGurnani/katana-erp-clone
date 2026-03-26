import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { TenantRequest, tenantWhere, tenantData } from '../middleware/tenant';
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
  salesPrice: z.coerce.number().optional(),
  purchasePrice: z.coerce.number().optional(),
  variants: z.array(variantSchema).optional(),
});

const include = { variants: true };

router.get('/', async (req: TenantRequest, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = { ...tenantWhere(req) };
  if (req.query.search) where.name = { contains: req.query.search as string };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { name: 'asc' }, include }),
    prisma.product.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req: TenantRequest, res) => {
  const { variants, ...data } = schema.parse(req.body);
  const variantData = variants?.map(v => ({
    name: v.name,
    sku: v.sku,
    salesPrice: v.salesPrice ?? v.salePrice,
    purchasePrice: v.purchasePrice ?? v.unitCost,
  }));
  const product = await prisma.product.create({
    data: {
      ...tenantData(req),
      name: data.name,
      sku: data.sku,
      description: data.description ?? undefined,
      category: data.category ?? undefined,
      isManufactured: data.isManufactured,
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

router.get('/:id', async (req: TenantRequest, res) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, ...tenantWhere(req) },
    include: { variants: true, boms: { include: { rows: true, operations: true } } },
  });
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

router.patch('/:id', async (req: TenantRequest, res) => {
  const data = schema.partial().parse(req.body);
  const { variants, ...rest } = data;
  const product = await prisma.product.update({ where: { id: req.params.id }, data: rest, include });
  res.json(product);
});

router.delete('/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ── BOMs ────────────────────────────────────────────────────────────────────
router.get('/:id/boms', async (req, res) => {
  const boms = await prisma.bOM.findMany({
    where: { productId: req.params.id },
    include: { rows: true, operations: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(boms);
});

router.post('/:id/boms', async (req: TenantRequest, res) => {
  const data = z.object({
    name: z.string().min(1),
    variantId: z.string().uuid().nullish(),
    qty: z.coerce.number().default(1),
    notes: z.string().nullish(),
    rows: z.array(z.object({ materialId: z.string().nullish(), variantId: z.string().nullish(), qty: z.coerce.number(), unitCost: z.coerce.number().optional(), notes: z.string().nullish() })).optional(),
    operations: z.array(z.object({ name: z.string(), rank: z.number().default(0), durationMinutes: z.number().int().nullish(), costPerHour: z.coerce.number().nullish(), notes: z.string().nullish() })).optional(),
  }).parse(req.body);

  const bom = await prisma.bOM.create({
    data: {
      ...tenantData(req),
      productId: req.params.id,
      name: data.name,
      variantId: data.variantId ?? undefined,
      qty: data.qty,
      notes: data.notes ?? undefined,
      rows: data.rows?.length ? { create: data.rows.map(r => ({ materialId: r.materialId ?? undefined, variantId: r.variantId ?? undefined, qty: r.qty, unitCost: r.unitCost, notes: r.notes ?? undefined })) } : undefined,
      operations: data.operations?.length ? { create: data.operations } : undefined,
    },
    include: { rows: true, operations: true },
  });
  res.status(201).json(bom);
});

// ── BOM CRUD ────────────────────────────────────────────────────────────────
router.get('/:productId/boms/:bomId', async (req, res) => {
  const bom = await prisma.bOM.findFirst({ where: { id: req.params.bomId, productId: req.params.productId }, include: { rows: true, operations: true } });
  if (!bom) return res.status(404).json({ error: 'Not found' });
  res.json(bom);
});

router.patch('/:productId/boms/:bomId', async (req, res) => {
  const data = z.object({ name: z.string().optional(), qty: z.coerce.number().optional(), notes: z.string().nullish(), isActive: z.boolean().optional() }).parse(req.body);
  const bom = await prisma.bOM.update({ where: { id: req.params.bomId }, data, include: { rows: true, operations: true } });
  res.json(bom);
});

router.delete('/:productId/boms/:bomId', async (req, res) => {
  await prisma.bOM.delete({ where: { id: req.params.bomId } });
  res.status(204).send();
});

// ── BOM Row CRUD ──────────────────────────────────────────────────────────────
router.post('/:productId/boms/:bomId/rows', async (req, res) => {
  const data = z.object({ materialId: z.string().nullish(), variantId: z.string().nullish(), qty: z.coerce.number(), unitCost: z.coerce.number().optional(), notes: z.string().nullish() }).parse(req.body);
  const row = await prisma.bOMRow.create({ data: { bomId: req.params.bomId, materialId: data.materialId ?? undefined, variantId: data.variantId ?? undefined, qty: data.qty, unitCost: data.unitCost, notes: data.notes ?? undefined } });
  res.status(201).json(row);
});

router.patch('/:productId/boms/:bomId/rows/:rowId', async (req, res) => {
  const data = z.object({ qty: z.coerce.number().optional(), unitCost: z.coerce.number().optional(), notes: z.string().nullish() }).parse(req.body);
  const row = await prisma.bOMRow.update({ where: { id: req.params.rowId }, data });
  res.json(row);
});

router.delete('/:productId/boms/:bomId/rows/:rowId', async (req, res) => {
  await prisma.bOMRow.delete({ where: { id: req.params.rowId } });
  res.status(204).send();
});

// ── BOM Operation CRUD ────────────────────────────────────────────────────────
router.post('/:productId/boms/:bomId/operations', async (req, res) => {
  const data = z.object({ name: z.string(), rank: z.number().default(0), durationMinutes: z.number().int().nullish(), costPerHour: z.coerce.number().nullish(), notes: z.string().nullish() }).parse(req.body);
  const op = await prisma.productOperation.create({ data: { bomId: req.params.bomId, ...data } });
  res.status(201).json(op);
});

router.patch('/:productId/boms/:bomId/operations/:opId', async (req, res) => {
  const data = z.object({ name: z.string().optional(), rank: z.number().optional(), durationMinutes: z.number().int().nullish(), costPerHour: z.coerce.number().nullish(), notes: z.string().nullish() }).parse(req.body);
  const op = await prisma.productOperation.update({ where: { id: req.params.opId }, data });
  res.json(op);
});

router.delete('/:productId/boms/:bomId/operations/:opId', async (req, res) => {
  await prisma.productOperation.delete({ where: { id: req.params.opId } });
  res.status(204).send();
});

export default router;
