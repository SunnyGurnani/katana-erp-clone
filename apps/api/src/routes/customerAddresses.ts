import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  type: z.string().default('billing'),
  line1: z.string().nullish(),
  line2: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  country: z.string().nullish(),
  isDefault: z.boolean().default(false),
});

router.get('/customers/:customerId/addresses', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { customerId: req.params.customerId };
  const [items, total] = await Promise.all([
    prisma.customerAddress.findMany({ where, skip, take }),
    prisma.customerAddress.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/customers/:customerId/addresses', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.customerAddress.create({
    data: { customerId: req.params.customerId, ...data },
  });
  res.status(201).json(item);
});

router.patch('/addresses/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const item = await prisma.customerAddress.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/addresses/:id', async (req, res) => {
  await prisma.customerAddress.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
