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
  category: z.string().nullish(),
  unitOfMeasure: z.string().default('pcs'),
  isActive: z.boolean().default(true),
  trackLots: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  purchasePrice: z.coerce.number().nullish(),
  reorderPoint: z.coerce.number().nullish(),
  leadTimeDays: z.number().int().nullish(),
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = req.query.search ? { name: { contains: req.query.search as string } } : {};
  const [items, total] = await Promise.all([prisma.material.findMany({ where, skip, take, orderBy: { name: 'asc' } }), prisma.material.count({ where })]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const m = await prisma.material.create({ data: { ...data, sku: data.sku ?? undefined } });
  res.status(201).json(m);
});

router.get('/:id', async (req, res) => {
  const m = await prisma.material.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json(m);
});

router.patch('/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const m = await prisma.material.update({ where: { id: req.params.id }, data });
  res.json(m);
});

router.delete('/:id', async (req, res) => {
  await prisma.material.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
