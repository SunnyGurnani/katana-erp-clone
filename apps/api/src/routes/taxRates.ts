import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string(),
  rate: z.coerce.number(),
  isDefault: z.boolean().default(false),
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.taxRate.findMany({ skip, take, orderBy: { name: 'asc' } }),
    prisma.taxRate.count(),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.taxRate.create({ data });
  res.status(201).json(item);
});

router.patch('/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const item = await prisma.taxRate.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.taxRate.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
