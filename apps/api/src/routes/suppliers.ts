import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { TenantRequest, tenantWhere, tenantData } from '../middleware/tenant';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string(), code: z.string().nullish(), email: z.string().nullish(), phone: z.string().nullish(),
  address: z.string().nullish(), currency: z.string().default('USD'), paymentTerms: z.string().nullish(),
  notes: z.string().nullish(), isActive: z.boolean().default(true),
});

router.get('/', async (req: TenantRequest, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = { ...tenantWhere(req) };
  if (req.query.search) where.name = { contains: req.query.search as string };
  const [items, total] = await Promise.all([prisma.supplier.findMany({ where, skip, take, orderBy: { name: 'asc' } }), prisma.supplier.count({ where })]);
  res.json(paginated(items, total, page, pageSize));
});

router.post('/', async (req: TenantRequest, res) => {
  const s = await prisma.supplier.create({ data: { ...schema.parse(req.body), ...tenantData(req) } });
  res.status(201).json(s);
});

router.get('/:id', async (req: TenantRequest, res) => {
  const s = await prisma.supplier.findFirst({ where: { id: req.params.id, ...tenantWhere(req) } });
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

router.patch('/:id', async (req, res) => {
  const s = await prisma.supplier.update({ where: { id: req.params.id }, data: schema.partial().parse(req.body) });
  res.json(s);
});

router.delete('/:id', async (req, res) => {
  await prisma.supplier.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
