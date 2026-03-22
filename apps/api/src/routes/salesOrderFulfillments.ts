import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.orderId) where.orderId = req.query.orderId;
  if (req.query.rowId) where.rowId = req.query.rowId;
  const [items, total] = await Promise.all([
    prisma.salesOrderFulfillment.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.salesOrderFulfillment.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/:id', async (req, res) => {
  const item = await prisma.salesOrderFulfillment.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.post('/', async (req, res) => {
  const data = z.object({
    orderId: z.string().uuid(),
    rowId: z.string().uuid(),
    qty: z.coerce.number().positive(),
    locationId: z.string().uuid().nullish(),
    isReturn: z.boolean().default(false),
    notes: z.string().nullish(),
  }).parse(req.body);
  const item = await prisma.salesOrderFulfillment.create({
    data: {
      orderId: data.orderId,
      rowId: data.rowId,
      qty: data.qty,
      locationId: data.locationId ?? undefined,
      isReturn: data.isReturn,
      notes: data.notes ?? undefined,
    },
  });
  res.status(201).json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.salesOrderFulfillment.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
