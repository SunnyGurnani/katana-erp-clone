import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string(),
  sku: z.string().nullish(),
  description: z.string().nullish(),
  category: z.string().nullish(),
  unitOfMeasure: z.string().default('pcs'),
  isActive: z.boolean().default(true),
  isManufactured: z.boolean().default(false),
  salesPrice: z.string().nullish(),
  purchasePrice: z.string().nullish(),
  imageUrl: z.string().nullish(),
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = req.query.search ? { name: { contains: req.query.search as string, mode: 'insensitive' as const } } : {};
  const [items, total] = await Promise.all([prisma.product.findMany({ where, skip, take, orderBy: { name: 'asc' } }), prisma.product.count({ where })]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const product = await prisma.product.create({ data: { ...data, salesPrice: data.salesPrice ?? undefined, purchasePrice: data.purchasePrice ?? undefined } });
  res.status(201).json(product);
});

router.get('/:id', async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id }, include: { variants: true } });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

router.patch('/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const p = await prisma.product.update({ where: { id: req.params.id }, data });
  res.json(p);
});

router.delete('/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
