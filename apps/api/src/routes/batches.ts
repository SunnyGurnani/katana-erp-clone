import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const batchSchema = z.object({
  variantId: z.string().uuid(),
  batchNumber: z.string(),
  expiryDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

// GET /batches
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { variantId } = req.query as Record<string, string>;
  const where: any = {};
  if (variantId) where.variantId = variantId;
  const [items, total] = await Promise.all([
    prisma.batch.findMany({ where, include: { stocks: { include: { location: true } } }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.batch.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /batches
router.post('/', async (req, res) => {
  const data = batchSchema.parse(req.body);
  const item = await prisma.batch.create({ data, include: { stocks: true } });
  res.status(201).json(item);
});

// GET /batches/:id
router.get('/:id', async (req, res) => {
  const item = await prisma.batch.findUnique({ where: { id: req.params.id }, include: { stocks: { include: { location: true } } } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// PATCH /batches/:id
router.patch('/:id', async (req, res) => {
  const data = batchSchema.partial().parse(req.body);
  const item = await prisma.batch.update({ where: { id: req.params.id }, data });
  res.json(item);
});

// DELETE /batches/:id
router.delete('/:id', async (req, res) => {
  await prisma.batch.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ── Batch Stocks ──────────────────────────────────────────────────────────────

// GET /batch_stocks
router.get('/stocks/list', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { batchId, locationId } = req.query as Record<string, string>;
  const where: any = {};
  if (batchId) where.batchId = batchId;
  if (locationId) where.locationId = locationId;
  const [items, total] = await Promise.all([
    prisma.batchStock.findMany({ where, include: { batch: true, location: true }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.batchStock.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /batch_stocks
router.post('/stocks', async (req, res) => {
  const data = z.object({
    batchId: z.string().uuid(),
    locationId: z.string().uuid(),
    onHand: z.coerce.number().min(0).default(0),
    allocated: z.coerce.number().min(0).default(0),
  }).parse(req.body);
  const item = await prisma.batchStock.upsert({
    where: { batchId_locationId: { batchId: data.batchId, locationId: data.locationId } },
    create: data,
    update: { onHand: data.onHand, allocated: data.allocated, updatedAt: new Date() },
    include: { batch: true, location: true },
  });
  res.status(201).json(item);
});

// PATCH /batch_stocks/:id
router.patch('/stocks/:id', async (req, res) => {
  const data = z.object({
    onHand: z.coerce.number().min(0).optional(),
    allocated: z.coerce.number().min(0).optional(),
  }).parse(req.body);
  const item = await prisma.batchStock.update({ where: { id: req.params.id }, data, include: { batch: true, location: true } });
  res.json(item);
});

export default router;
