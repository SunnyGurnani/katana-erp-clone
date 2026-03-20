import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router({ mergeParams: true });

const schema = z.object({
  type: z.string().default('shipping'),
  line1: z.string().nullish(),
  line2: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  country: z.string().nullish(),
});

router.get('/:orderId/addresses', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { orderId: req.params.orderId };
  const [items, total] = await Promise.all([
    prisma.salesOrderAddress.findMany({ where, skip, take }),
    prisma.salesOrderAddress.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/:orderId/addresses', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.salesOrderAddress.create({
    data: { orderId: req.params.orderId, ...data },
  });
  res.status(201).json(item);
});

router.patch('/addresses/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const item = await prisma.salesOrderAddress.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/addresses/:id', async (req, res) => {
  await prisma.salesOrderAddress.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
