import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  const data = z.object({
    moId: z.string().uuid(),
    operationId: z.string().uuid().nullish(),
    name: z.string(),
    status: z.string().default('pending'),
  }).parse(req.body);
  const item = await prisma.mOOperationRow.create({ data });
  res.status(201).json(item);
});

router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.moId) where.moId = req.query.moId;
  const [items, total] = await Promise.all([
    prisma.mOOperationRow.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.mOOperationRow.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

router.get('/:id', async (req, res) => {
  const item = await prisma.mOOperationRow.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.patch('/:id', async (req, res) => {
  const data = z.object({
    name: z.string().optional(),
    status: z.string().optional(),
    actualMinutes: z.coerce.number().nullish(),
  }).parse(req.body);
  const item = await prisma.mOOperationRow.update({ where: { id: req.params.id }, data });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await prisma.mOOperationRow.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
