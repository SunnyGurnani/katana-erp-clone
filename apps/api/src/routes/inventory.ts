import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.get('/levels', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.locationId) where.locationId = req.query.locationId;
  if (req.query.variantId) where.variantId = req.query.variantId;
  const [items, total] = await Promise.all([prisma.inventoryLevel.findMany({ where, skip, take }), prisma.inventoryLevel.count({ where })]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/movements', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.variantId) where.variantId = req.query.variantId;
  if (req.query.locationId) where.locationId = req.query.locationId;
  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.inventoryMovement.count({ where })
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /inventory/reorder_points — set reorder point for a variant+location
router.post('/reorder-points', async (req, res) => {
  const { variantId, locationId, reorderPoint } = z.object({
    variantId: z.string().uuid(),
    locationId: z.string().uuid(),
    reorderPoint: z.coerce.number().min(0),
  }).parse(req.body);

  const item = await prisma.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, reorderPoint, onHand: 0, allocated: 0 },
    update: { reorderPoint },
  });
  res.json(item);
});

// POST /inventory/safety_stock_levels — set reorder qty (safety stock) for a variant+location
router.post('/safety-stock', async (req, res) => {
  const { variantId, locationId, reorderQty } = z.object({
    variantId: z.string().uuid(),
    locationId: z.string().uuid(),
    reorderQty: z.coerce.number().min(0),
  }).parse(req.body);

  const item = await prisma.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, reorderQty, onHand: 0, allocated: 0 },
    update: { reorderQty },
  });
  res.json(item);
});

// GET /inventory/negative_stock — variants with onHand < 0
router.get('/negative-stock', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { onHand: { lt: 0 } };
  const [items, total] = await Promise.all([
    prisma.inventoryLevel.findMany({ where, include: { variant: { include: { product: true } }, location: true }, skip, take, orderBy: { onHand: 'asc' } }),
    prisma.inventoryLevel.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

export default router;
