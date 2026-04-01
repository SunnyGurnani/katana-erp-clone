import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

router.post('/', async (req, res) => {
  const data = z.object({
    priceListId: z.string().uuid(),
    customerId: z.string().uuid(),
  }).parse(req.body);
  const item = await prisma.priceListCustomer.create({ data });
  res.status(201).json(item);
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.priceListId) where.priceListId = req.query.priceListId;
  const [items, total] = await Promise.all([
    prisma.priceListCustomer.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.priceListCustomer.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/:id', async (req, res) => {
  const item = await prisma.priceListCustomer.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.priceListCustomer.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
