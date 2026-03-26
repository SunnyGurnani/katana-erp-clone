import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { TenantRequest, tenantWhere, tenantData } from '../middleware/tenant';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({ name: z.string(), address: z.string().nullish(), isActive: z.boolean().default(true), isDefault: z.boolean().default(false) });

router.get('/', async (req: TenantRequest, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { ...tenantWhere(req) };
  const [items, total] = await Promise.all([prisma.location.findMany({ where, skip, take, orderBy: { name: 'asc' } }), prisma.location.count({ where })]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req: TenantRequest, res) => {
  const l = await prisma.location.create({ data: { ...schema.parse(req.body), ...tenantData(req) } });
  res.status(201).json(l);
});

router.get('/:id', async (req: TenantRequest, res) => {
  const l = await prisma.location.findFirst({ where: { id: req.params.id, ...tenantWhere(req) } });
  if (!l) return res.status(404).json({ error: 'Not found' });
  res.json(l);
});

router.patch('/:id', async (req, res) => {
  const l = await prisma.location.update({ where: { id: req.params.id }, data: schema.partial().parse(req.body) });
  res.json(l);
});

export default router;
