import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.variantId) where.variantId = req.query.variantId;
  if (req.query.locationId) where.locationId = req.query.locationId;
  if (req.query.movementType) where.movementType = req.query.movementType;
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt.gte = new Date(req.query.from as string);
    if (req.query.to) where.createdAt.lte = new Date(req.query.to as string);
  }
  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where, skip, take, orderBy: { createdAt: 'desc' },
      include: { variant: { select: { name: true, sku: true } }, location: { select: { name: true } } },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);
  const enriched = items.map((m: any) => ({
    ...m,
    reference:
      m.note ||
      (m.referenceType && m.referenceId ? `${m.referenceType} ${m.referenceId.slice(0, 8)}…` : null) ||
      null,
  }));
  res.json(paginated(enriched, total, page, pageSize));
});

export default router;
