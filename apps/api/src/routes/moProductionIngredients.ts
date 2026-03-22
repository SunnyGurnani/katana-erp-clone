import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.productionId) where.productionId = req.query.productionId;
  const [items, total] = await Promise.all([
    prisma.mOProductionIngredient.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.mOProductionIngredient.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.patch('/:id', async (req, res) => {
  const { qtyConsumed } = z.object({
    qtyConsumed: z.coerce.number(),
  }).parse(req.body);
  const item = await prisma.mOProductionIngredient.update({
    where: { id: req.params.id },
    data: { qtyConsumed },
  });
  res.json(item);
});

export default router;
