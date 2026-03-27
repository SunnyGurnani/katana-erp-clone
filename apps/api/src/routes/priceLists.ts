import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const listSchema = z.object({
  name: z.string(),
  currency: z.string().default('USD'),
  isDefault: z.boolean().default(false),
  notes: z.string().nullish(),
});

// Price lists CRUD
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([
    prisma.priceList.findMany({ include: { rows: true, customers: true }, skip, take, orderBy: { name: 'asc' } }),
    prisma.priceList.count(),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = listSchema.parse(req.body);
  const item = await prisma.priceList.create({ data });
  res.status(201).json(item);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.priceList.findUnique({ where: { id: req.params.id }, include: { rows: true, customers: true } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = listSchema.partial().parse(req.body);
  const item = await prisma.priceList.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.priceList.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Rows
const rowSchema = z.object({
  variantId: z.string().uuid().nullish(),
  serviceId: z.string().uuid().nullish(),
  price: z.coerce.number(),
  minQty: z.coerce.number().nullish(),
});

router.get('/:id/rows', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { priceListId: req.params.id };
  const [items, total] = await Promise.all([
    prisma.priceListRow.findMany({ where, skip, take }),
    prisma.priceListRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/:id/rows', async (req, res) => {
  const data = rowSchema.parse(req.body);
  const row = await prisma.priceListRow.create({
    data: { priceListId: req.params.id, ...data },
  });
  res.status(201).json(row);
});

router.patch('/rows/:id', async (req, res) => {
  const data = rowSchema.partial().parse(req.body);
  const row = await prisma.priceListRow.update({ where: { id: req.params.id }, data });
  res.json(row);
});

router.delete('/rows/:id', async (req, res) => {
  await prisma.priceListRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Customers
router.get('/:id/customers', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { priceListId: req.params.id };
  const [items, total] = await Promise.all([
    prisma.priceListCustomer.findMany({ where, skip, take }),
    prisma.priceListCustomer.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/:id/customers', async (req, res) => {
  const { customerId } = z.object({ customerId: z.string().uuid() }).parse(req.body);
  const item = await prisma.priceListCustomer.create({
    data: { priceListId: req.params.id, customerId },
  });
  res.status(201).json(item);
});

router.delete('/customers/:id', async (req, res) => {
  await prisma.priceListCustomer.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
