import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const variantSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().default('Default'),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  salesPrice: z.coerce.number().nullish(),
  purchasePrice: z.coerce.number().nullish(),
  isActive: z.boolean().default(true),
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.productId) where.productId = req.query.productId;
  if (req.query.search) where.name = { contains: req.query.search as string, mode: 'insensitive' };
  const [items, total] = await Promise.all([
    prisma.variant.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { product: { select: { id: true, name: true } } } }),
    prisma.variant.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = variantSchema.parse(req.body);
  const item = await prisma.variant.create({
    data: {
      productId: data.productId,
      name: data.name,
      sku: data.sku ?? undefined,
      barcode: data.barcode ?? undefined,
      salesPrice: data.salesPrice ?? undefined,
      purchasePrice: data.purchasePrice ?? undefined,
      isActive: data.isActive,
    },
    include: { product: { select: { id: true, name: true } } },
  });
  res.status(201).json(item);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.variant.findUnique({
    where: { id: req.params.id },
    include: { product: { select: { id: true, name: true } }, inventoryLevels: true },
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = variantSchema.partial().parse(req.body);
  const item = await prisma.variant.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      sku: data.sku ?? undefined,
      barcode: data.barcode ?? undefined,
      salesPrice: data.salesPrice ?? undefined,
      purchasePrice: data.purchasePrice ?? undefined,
      isActive: data.isActive,
    },
    include: { product: { select: { id: true, name: true } } },
  });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.variant.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Storage Bins ─────────────────────────────────────────────────────────────

// GET variant's storage bins
router.get('/:id/storage-bins', async (req, res) => {
  const bins = await prisma.variantBinLocation.findMany({
    where: { variantId: req.params.id },
    include: { storageBin: { include: { location: true } } },
  });
  res.json(bins);
});

// Link variant to storage bin
router.post('/:id/storage-bins', async (req, res) => {
  const { storageBinId, isPrimary } = z.object({
    storageBinId: z.string().uuid(),
    isPrimary: z.boolean().default(false),
  }).parse(req.body);

  if (isPrimary) {
    await prisma.variantBinLocation.updateMany({
      where: { variantId: req.params.id },
      data: { isPrimary: false },
    });
  }

  const link = await prisma.variantBinLocation.create({
    data: { variantId: req.params.id, storageBinId, isPrimary },
    include: { storageBin: { include: { location: true } } },
  });
  res.status(201).json(link);
});

// Unlink variant from storage bin
router.delete('/:id/storage-bins/:binLinkId', async (req, res) => {
  await prisma.variantBinLocation.delete({ where: { id: req.params.binLinkId } });
  res.status(204).send();
});

export default router;
