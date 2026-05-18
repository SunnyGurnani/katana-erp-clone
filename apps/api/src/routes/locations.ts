import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const schema = z.object({ name: z.string(), address: z.string().nullish(), isActive: z.boolean().default(true), isDefault: z.boolean().default(false) });

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const [items, total] = await Promise.all([prisma.location.findMany({ skip, take, orderBy: { name: 'asc' } }), prisma.location.count()]);
  res.json(paginated(items, total, page, pageSize));
});
router.post('/', async (req, res) => { const l = await prisma.location.create({ data: schema.parse(req.body) }); res.status(201).json(l); });
router.get('/:id', async (req, res) => { const l = await prisma.location.findUnique({ where: { id: req.params.id } }); if (!l) return res.status(404).json({ error: 'Not found' }); res.json(l); });
router.patch('/:id', async (req, res) => { const l = await prisma.location.update({ where: { id: req.params.id }, data: schema.partial().parse(req.body) }); res.json(l); });
router.put('/:id', async (req, res) => { const l = await prisma.location.update({ where: { id: req.params.id }, data: schema.partial().parse(req.body) }); res.json(l); });
router.delete('/:id', async (req, res) => { await prisma.location.delete({ where: { id: req.params.id } }); res.status(204).send(); });

export default router;
