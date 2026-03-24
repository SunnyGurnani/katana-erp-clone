import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';

const router = Router();
router.use(authenticate);

// GET /serial-number-stock — serial numbers with their variant & inventory data
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.variantId) where.variantId = req.query.variantId;
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) where.serialNumber = { contains: req.query.search as string };

  const [items, total] = await Promise.all([
    prisma.serialNumber.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.serialNumber.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

export default router;
