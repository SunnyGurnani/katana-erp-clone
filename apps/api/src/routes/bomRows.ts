import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const rowSchema = z.object({
  bomId: z.string().uuid(),
  materialId: z.string().uuid().nullish(),
  variantId: z.string().uuid().nullish(),
  qty: z.coerce.number(),
  unitCost: z.coerce.number().nullish(),
  notes: z.string().nullish(),
});

router.post('/', async (req, res) => {
  const data = rowSchema.parse(req.body);
  const item = await prisma.bOMRow.create({ data });
  res.status(201).json(item);
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.bomId) where.bomId = req.query.bomId;
  const [items, total] = await Promise.all([
    prisma.bOMRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.bOMRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/bulk', async (req, res) => {
  const { rows } = z.object({
    rows: z.array(rowSchema),
  }).parse(req.body);
  const items = await prisma.$transaction(
    rows.map(data => prisma.bOMRow.create({ data })),
  );
  res.status(201).json(items);
});

router.patch('/:id', async (req, res) => {
  const data = z.object({
    materialId: z.string().uuid().nullish(),
    variantId: z.string().uuid().nullish(),
    qty: z.coerce.number().optional(),
    unitCost: z.coerce.number().nullish(),
    notes: z.string().nullish(),
  }).parse(req.body);
  const item = await prisma.bOMRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.bOMRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
