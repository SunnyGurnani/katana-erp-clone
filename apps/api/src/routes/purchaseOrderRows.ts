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
  const [items, total] = await Promise.all([
    prisma.purchaseOrderRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.purchaseOrderRow.count({ where }),
  ]);
  res.json(paginated(items.map((r: any) => ({ ...r, qty: r.qtyOrdered, unitCost: r.unitPrice })), total, page, pageSize));
});

router.get('/:id', async (req, res) => {
  const item = await prisma.purchaseOrderRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ ...item, qty: item.qtyOrdered, unitCost: item.unitPrice });
});

router.patch('/:id', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(),
    materialId: z.string().uuid().nullish(),
    description: z.string().nullish(),
    qty: z.coerce.number().nullish(),
    unitCost: z.coerce.number().nullish(),
  }).parse(req.body);
  const update: any = {};
  if (data.variantId !== undefined) update.variantId = data.variantId;
  if (data.materialId !== undefined) update.materialId = data.materialId;
  if (data.description !== undefined) update.description = data.description;
  if (data.qty != null) update.qtyOrdered = data.qty;
  if (data.unitCost != null) update.unitPrice = data.unitCost;
  const item = await prisma.purchaseOrderRow.update({ where: { id: req.params.id }, data: update });
  res.json({ ...item, qty: item.qtyOrdered, unitCost: item.unitPrice });
});

router.delete('/:id', async (req, res) => {
  await prisma.purchaseOrderRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
