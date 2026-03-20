import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  description: z.string().default('Shipping'),
  amount: z.coerce.number(),
  taxRateId: z.string().uuid().nullish(),
});

// POST /sales-orders/:orderId/shipping-fees
router.post('/sales-orders/:orderId/shipping-fees', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.salesOrderShippingFee.create({
    data: { orderId: req.params.orderId, ...data },
  });
  res.status(201).json(item);
});

router.get('/shipping-fees', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.orderId) where.orderId = req.query.orderId;
  const [items, total] = await Promise.all([
    prisma.salesOrderShippingFee.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.salesOrderShippingFee.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/shipping-fees/:id', async (req, res) => {
  const item = await prisma.salesOrderShippingFee.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/shipping-fees/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const item = await prisma.salesOrderShippingFee.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/shipping-fees/:id', async (req, res) => {
  await prisma.salesOrderShippingFee.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
