import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string(),
  sku: z.string().nullish(),
  description: z.string().nullish(),
  price: z.coerce.number().nullish(),
  taxRateId: z.string().uuid().nullish(),
  isActive: z.boolean().default(true),
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';
  const [items, total] = await Promise.all([
    prisma.service.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.service.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.service.create({ data });
  res.status(201).json(item);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.service.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const item = await prisma.service.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.service.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
