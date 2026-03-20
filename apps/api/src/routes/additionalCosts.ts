import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

// GET /additional_costs
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.additionalCost.findMany({ skip, take, orderBy: { name: 'asc' } }),
    prisma.additionalCost.count(),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /additional_costs
router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.additionalCost.create({ data });
  res.status(201).json(item);
});

// PATCH /additional_costs/:id
router.patch('/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const item = await prisma.additionalCost.update({ where: { id: req.params.id }, data });
  res.json(item);
});

// DELETE /additional_costs/:id
router.delete('/:id', async (req, res) => {
  await prisma.additionalCost.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
