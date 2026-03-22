import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  const data = z.object({
    priceListId: z.string().uuid(),
    variantId: z.string().uuid().nullish(),
    serviceId: z.string().uuid().nullish(),
    price: z.coerce.number(),
    minQty: z.coerce.number().nullish(),
  }).parse(req.body);
  const item = await prisma.priceListRow.create({ data });
  res.status(201).json(item);
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.priceListId) where.priceListId = req.query.priceListId;
  const [items, total] = await Promise.all([
    prisma.priceListRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.priceListRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/:id', async (req, res) => {
  const item = await prisma.priceListRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(),
    serviceId: z.string().uuid().nullish(),
    price: z.coerce.number().optional(),
    minQty: z.coerce.number().nullish(),
  }).parse(req.body);
  const item = await prisma.priceListRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.priceListRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
