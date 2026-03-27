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
  name: z.string(), code: z.string().nullish(), email: z.string().nullish(), phone: z.string().nullish(),
  address: z.string().nullish(), currency: z.string().default('USD'), paymentTerms: z.string().nullish(),
  notes: z.string().nullish(), isActive: z.boolean().default(true),
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = req.query.search ? { name: { contains: req.query.search as string } } : {};
  const [items, total] = await Promise.all([prisma.customer.findMany({ where, skip, take, orderBy: { name: 'asc' } }), prisma.customer.count({ where })]);
  res.json(paginated(items, total, page, pageSize));
});
router.post('/', async (req, res) => { const c = await prisma.customer.create({ data: schema.parse(req.body) }); res.status(201).json(c); });
router.get('/:id', async (req, res) => { const c = await prisma.customer.findUnique({ where: { id: req.params.id } }); if (!c) return res.status(404).json({ error: 'Not found' }); res.json(c); });
router.patch('/:id', async (req, res) => { const c = await prisma.customer.update({ where: { id: req.params.id }, data: schema.partial().parse(req.body) }); res.json(c); });
router.delete('/:id', async (req, res) => { await prisma.customer.delete({ where: { id: req.params.id } }); res.status(204).send(); });

export default router;
