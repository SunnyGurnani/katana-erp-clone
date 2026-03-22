import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  const data = z.object({
    stocktakeId: z.string().uuid(),
    variantId: z.string().uuid(),
    countedQty: z.coerce.number(),
    systemQty: z.coerce.number(),
  }).parse(req.body);
  const variance = data.countedQty - data.systemQty;
  const item = await prisma.stocktakeRow.create({ data: { ...data, variance } });
  res.status(201).json(item);
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.stocktakeId) where.stocktakeId = req.query.stocktakeId;
  const [items, total] = await Promise.all([
    prisma.stocktakeRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.stocktakeRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.patch('/:id', async (req, res) => {
  const { countedQty } = z.object({
    countedQty: z.coerce.number(),
  }).parse(req.body);
  const existing = await prisma.stocktakeRow.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const variance = countedQty - Number(existing.systemQty);
  const item = await prisma.stocktakeRow.update({
    where: { id: req.params.id },
    data: { countedQty, variance },
  });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.stocktakeRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
