import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const entityType = (req.query.entityType || req.query.type) as string | undefined;
  const where = entityType ? { entityType } : {};
  const items = await prisma.itemCategory.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  res.json({ data: items });
});

router.use(requireOperatorForMutations);

const schema = z.object({
  name: z.string().min(1),
  entityType: z.enum(['product', 'material']),
});

router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.itemCategory.create({
    data: { name: data.name.trim(), entityType: data.entityType },
  });
  res.status(201).json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.itemCategory.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
