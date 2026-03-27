import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

// Standalone sales-order-rows endpoints (beyond the nested /:id/rows on SO router)

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.orderId) where.orderId = req.query.orderId;
  const [items, total] = await Promise.all([
    prisma.salesOrderRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { fulfillments: true } }),
    prisma.salesOrderRow.count({ where }),
  ]);
  res.json(paginated(items.map((r: any) => ({ ...r, qty: r.qtyOrdered, salePrice: r.unitPrice })), total, page, pageSize));
});

router.get('/:id', async (req, res) => {
  const item = await prisma.salesOrderRow.findUnique({ where: { id: req.params.id }, include: { fulfillments: true } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ ...item, qty: item.qtyOrdered, salePrice: item.unitPrice });
});

router.patch('/:id', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(),
    description: z.string().nullish(),
    qty: z.coerce.number().nullish(),
    salePrice: z.coerce.number().nullish(),
  }).parse(req.body);
  const update: any = {};
  if (data.variantId !== undefined) update.variantId = data.variantId;
  if (data.description !== undefined) update.description = data.description;
  if (data.qty != null) update.qtyOrdered = data.qty;
  if (data.salePrice != null) update.unitPrice = data.salePrice;
  const item = await prisma.salesOrderRow.update({ where: { id: req.params.id }, data: update });
  res.json({ ...item, qty: item.qtyOrdered, salePrice: item.unitPrice });
});

router.delete('/:id', async (req, res) => {
  await prisma.salesOrderRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
