import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// ── Storage Bins (bin_locations in Katana) ────────────────────────────────────

// GET /bin_locations
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { locationId } = req.query as Record<string, string>;
  const where: any = {};
  if (locationId) where.locationId = locationId;
  const [items, total] = await Promise.all([
    prisma.storageBin.findMany({ where, include: { location: true, variantBins: true }, skip, take, orderBy: { name: 'asc' } }),
    prisma.storageBin.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /bin_locations
router.post('/', async (req, res) => {
  const data = z.object({ name: z.string(), locationId: z.string().uuid() }).parse(req.body);
  const item = await prisma.storageBin.create({ data, include: { location: true } });
  res.status(201).json(item);
});

// GET /bin_locations/:id
router.get('/:id', async (req, res) => {
  const item = await prisma.storageBin.findUnique({ where: { id: req.params.id }, include: { location: true, variantBins: true } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// PATCH /bin_locations/:id
router.patch('/:id', async (req, res) => {
  const data = z.object({ name: z.string().optional(), locationId: z.string().uuid().optional() }).parse(req.body);
  const item = await prisma.storageBin.update({ where: { id: req.params.id }, data });
  res.json(item);
});

// DELETE /bin_locations/:id
router.delete('/:id', async (req, res) => {
  await prisma.storageBin.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ── Variant Bin Locations ─────────────────────────────────────────────────────

// GET /variant_bin_locations
router.get('/variant-assignments/list', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { variantId, storageBinId } = req.query as Record<string, string>;
  const where: any = {};
  if (variantId) where.variantId = variantId;
  if (storageBinId) where.storageBinId = storageBinId;
  const [items, total] = await Promise.all([
    prisma.variantBinLocation.findMany({ where, include: { storageBin: { include: { location: true } } }, skip, take }),
    prisma.variantBinLocation.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /variant_bin_locations — assign variant to bin
router.post('/variant-assignments', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid(),
    storageBinId: z.string().uuid(),
    isPrimary: z.boolean().default(false),
  }).parse(req.body);

  // If setting as primary, unset others for this variant
  if (data.isPrimary) {
    await prisma.variantBinLocation.updateMany({ where: { variantId: data.variantId, isPrimary: true }, data: { isPrimary: false } });
  }

  const item = await prisma.variantBinLocation.upsert({
    where: { variantId_storageBinId: { variantId: data.variantId, storageBinId: data.storageBinId } },
    create: data,
    update: { isPrimary: data.isPrimary },
    include: { storageBin: { include: { location: true } } },
  });
  res.status(201).json(item);
});

// DELETE /variant_bin_locations/:id — unlink
router.delete('/variant-assignments/:id', async (req, res) => {
  await prisma.variantBinLocation.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /unlink_variant_bin_locations — unlink by variantId + storageBinId
router.post('/unlink', async (req, res) => {
  const { variantId, storageBinId } = z.object({
    variantId: z.string().uuid(),
    storageBinId: z.string().uuid(),
  }).parse(req.body);
  const item = await prisma.variantBinLocation.findUnique({
    where: { variantId_storageBinId: { variantId, storageBinId } },
  });
  if (!item) return res.status(404).json({ error: 'Assignment not found' });
  await prisma.variantBinLocation.delete({ where: { id: item.id } });
  res.status(204).send();
});

export default router;
