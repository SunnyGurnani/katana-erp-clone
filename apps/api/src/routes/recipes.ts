import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  const data = z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullish(),
    name: z.string(),
    qty: z.coerce.number().default(1),
    notes: z.string().nullish(),
  }).parse(req.body);
  const item = await prisma.bOM.create({ data });
  res.status(201).json(item);
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.productId) where.productId = req.query.productId;
  const [items, total] = await Promise.all([
    prisma.bOM.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { rows: true, operations: true } }),
    prisma.bOM.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/:id', async (req, res) => {
  const item = await prisma.bOM.findUnique({
    where: { id: req.params.id },
    include: { rows: true, operations: { orderBy: { rank: 'asc' } } },
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = z.object({
    name: z.string().optional(),
    qty: z.coerce.number().optional(),
    notes: z.string().nullish(),
    isActive: z.boolean().optional(),
  }).parse(req.body);
  const item = await prisma.bOM.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.bOM.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
