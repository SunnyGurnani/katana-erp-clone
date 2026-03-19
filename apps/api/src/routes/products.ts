import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const variantSchema = z.object({
  name: z.string().default('Default'),
  sku: z.string().optional(),
  salesPrice: z.coerce.number().optional(),
  salePrice: z.coerce.number().optional(),
  purchasePrice: z.coerce.number().optional(),
  unitCost: z.coerce.number().optional(),
});

const schema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().nullish(),
  category: z.string().nullish(),
  status: z.string().default('active'),
  isManufactured: z.boolean().optional(),
  salesPrice: z.coerce.number().optional(),
  purchasePrice: z.coerce.number().optional(),
  variants: z.array(variantSchema).optional(),
});

const include = { variants: true };

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = req.query.search
    ? { name: { contains: req.query.search as string, mode: 'insensitive' as const } }
    : {};
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { name: 'asc' }, include }),
    prisma.product.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req, res) => {
  const { variants, ...data } = schema.parse(req.body);
  const variantData = variants?.map(v => ({
    name: v.name,
    sku: v.sku,
    salesPrice: v.salesPrice ?? v.salePrice,
    purchasePrice: v.purchasePrice ?? v.unitCost,
  }));
  const product = await prisma.product.create({
    data: {
      name: data.name,
      sku: data.sku,
      description: data.description ?? undefined,
      category: data.category ?? undefined,
      isManufactured: data.isManufactured,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
      variants: variantData?.length ? { create: variantData } : undefined,
    },
    include,
  });
  res.status(201).json(product);
});

router.get('/:id', async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id }, include });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

router.put('/:id', async (req, res) => {
  const { variants, ...data } = schema.partial().parse(req.body);
  const p = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      sku: data.sku,
      description: data.description ?? undefined,
      category: data.category ?? undefined,
      isManufactured: data.isManufactured,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
    },
    include,
  });
  res.json(p);
});

router.patch('/:id', async (req, res) => {
  const { variants, ...data } = schema.partial().parse(req.body);
  const p = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      sku: data.sku,
      description: data.description ?? undefined,
      category: data.category ?? undefined,
      isManufactured: data.isManufactured,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
    },
    include,
  });
  res.json(p);
});

router.delete('/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
