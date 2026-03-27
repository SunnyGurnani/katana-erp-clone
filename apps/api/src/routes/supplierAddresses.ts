import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

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

router.get('/suppliers/:supplierId/addresses', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { supplierId: req.params.supplierId };
  const [items, total] = await Promise.all([
    prisma.supplierAddress.findMany({ where, skip, take }),
    prisma.supplierAddress.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/suppliers/:supplierId/addresses', async (req, res) => {
  const data = schema.parse(req.body);
  const item = await prisma.supplierAddress.create({
    data: { supplierId: req.params.supplierId, ...data },
  });
  res.status(201).json(item);
});

router.patch('/addresses/:id', async (req, res) => {
  const data = schema.partial().parse(req.body);
  const item = await prisma.supplierAddress.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/addresses/:id', async (req, res) => {
  await prisma.supplierAddress.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
