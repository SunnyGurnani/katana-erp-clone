import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';

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

export default router;
