import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  const data = z.object({
    moId: z.string().uuid(),
    materialId: z.string().uuid().nullish(),
    variantId: z.string().uuid().nullish(),
    qtyPlanned: z.coerce.number(),
  }).parse(req.body);
  const item = await prisma.mORecipeRow.create({ data });
  res.status(201).json(item);
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.moId) where.moId = req.query.moId;
  const [items, total] = await Promise.all([
    prisma.mORecipeRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.mORecipeRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/:id', async (req, res) => {
  const item = await prisma.mORecipeRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = z.object({
    materialId: z.string().uuid().nullish(),
    variantId: z.string().uuid().nullish(),
    qtyPlanned: z.coerce.number().optional(),
    qtyConsumed: z.coerce.number().optional(),
  }).parse(req.body);
  const item = await prisma.mORecipeRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.mORecipeRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
