import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  const data = z.object({
    bomId: z.string().uuid(),
    name: z.string(),
    rank: z.coerce.number().int().default(0),
    durationMinutes: z.coerce.number().int().nullish(),
    costPerHour: z.coerce.number().nullish(),
    notes: z.string().nullish(),
  }).parse(req.body);
  const item = await prisma.productOperation.create({ data });
  res.status(201).json(item);
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.bomId) where.bomId = req.query.bomId;
  const [items, total] = await Promise.all([
    prisma.productOperation.findMany({ where, skip, take, orderBy: { rank: 'asc' } }),
    prisma.productOperation.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.patch('/:id', async (req, res) => {
  const data = z.object({
    name: z.string().optional(),
    rank: z.coerce.number().int().optional(),
    durationMinutes: z.coerce.number().int().nullish(),
    costPerHour: z.coerce.number().nullish(),
    notes: z.string().nullish(),
  }).parse(req.body);
  const item = await prisma.productOperation.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.productOperation.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.post('/:id/rank', async (req, res) => {
  const { rank } = z.object({ rank: z.coerce.number().int() }).parse(req.body);
  const item = await prisma.productOperation.update({
    where: { id: req.params.id },
    data: { rank },
  });
  res.json(item);
});

export default router;
