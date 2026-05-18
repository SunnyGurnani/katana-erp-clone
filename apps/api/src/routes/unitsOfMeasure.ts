import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const items = await prisma.measurementUnit.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.json({ data: items });
});

router.use(requireOperatorForMutations);

const schema = z.object({
  name: z.string().min(1).max(32),
  sortOrder: z.number().int().optional(),
});

router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const max = await prisma.measurementUnit.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.measurementUnit.create({
    data: {
      name: data.name.trim(),
      sortOrder: data.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
    },
  });
  res.status(201).json(item);
});

router.patch('/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const item = await prisma.measurementUnit.update({
    where: { id: req.params.id },
    data: {
      name: data.name?.trim(),
      sortOrder: data.sortOrder,
    },
  });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.measurementUnit.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
